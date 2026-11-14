#!/usr/bin/env python3
"""Release gates for the static Open Source Orchestra DAO Meet presentation."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
errors = []
checks = 0

def require(condition, message):
    global checks
    checks += 1
    if not condition:
        errors.append(message)

def load(relative):
    return json.loads((ROOT / relative).read_text())

deck = load('data/deck.json')
media = load('data/media.json')
slides = deck['slides']
items = media['items']
index = (ROOT / 'index.html').read_text()

require(len(slides) == 12, 'deck must have 12 slides')
require(len({s['id'] for s in slides}) == 12, 'slide IDs must be unique')
require(len(items) == 37, 'curated gallery must have 37 items')
require(len({i['id'] for i in items}) == 37, 'media IDs must be unique')
require(len({i['src'] for i in items}) == 37, 'media sources must be unique')
require([s['chord'] for s in slides] == ['G', 'Em', 'C', 'D', 'C', 'G'] * 2,
        'musical spine must be G Em C D C G twice')
require(sum(i['kind'] == 'portrait' for i in items) == 9, 'must have 9 public artist portraits')
require(sum(i['kind'] == 'history' for i in items) == 28, 'must have 24 history + 4 Mumbai items')
require(sum('/mumbai/' in i['src'] for i in items) == 4, 'must have exactly 4 Mumbai frames')

all_links = []
for slide in slides:
    require(slide.get('title') and slide.get('lede'), f'{slide["id"]}: title/lede required')
    require(3 <= len(slide['bullets']) <= 4, f'{slide["id"]}: 3–4 concise bullets required')
    if slide.get('image'):
        require((ROOT / slide['image'].removeprefix('./')).is_file(), f'{slide["id"]}: missing slide image')
        require(slide.get('imageAlt'), f'{slide["id"]}: slide image alt required')
    for link in slide.get('links', []) + slide.get('moreLinks', []):
        url = link['url']
        all_links.append(url)
        require(url.startswith('https://'), f'{slide["id"]}: non-HTTPS link {url}')
        require('meet.google.com' not in url, f'{slide["id"]}: private Meet link leaked')
        require('aloha@' not in url and 'contribute@' not in url, f'{slide["id"]}: mail link in deck data')
for item in items:
    require((ROOT / item['src'].removeprefix('./')).is_file(), f'missing media {item["src"]}')
    require(item.get('alt'), f'missing media alt {item["id"]}')
    require(item.get('sourceUrl', '').startswith('https://'), f'missing public source URL {item["id"]}')

require(len(set(all_links)) >= 35, 'complete public resource set must have at least 35 unique links')
require(index.count('data-slide-article=') == 12, 'no-JS static transcript must contain 12 articles')
require(index.count('<video') == 1 and 'autoplay' not in index.lower().split('<video')[1].split('>')[0] and ' src=' not in index.split('<video')[1].split('>')[0], 'theater video must be single, source-less and non-autoplay in HTML')
require('<iframe' not in index, 'no iframe may ship in the hall HTML')
require('https://osodaomeet.opensourceorchestra.org/' in index, 'canonical production URL missing')
require('property="og:image"' in index, 'social preview image missing')
require('name="twitter:card"' in index, 'Twitter preview card missing')
require('name="description"' in index, 'meta description missing')
require('id="share-button"' in index, 'share control missing')
require('id="print-button"' in index, 'print/save-PDF control missing')
require((ROOT / 'archive/index.html').is_file(), 'Listening Archive route missing')
require((ROOT / 'archive/status.json').is_file(), 'machine-readable archive status missing')
require((ROOT / 'circle/index.html').is_file(), 'OG Circle route missing')
require((ROOT / 'data/nodes.json').is_file(), 'OG Circle public feed missing')
require((ROOT / 'assets/og-oso-dao-meet.jpg').is_file(), 'social preview image file missing')
require((ROOT / 'vendor/LICENSE.three.txt').is_file(), 'Three.js MIT license missing')
require((ROOT / 'LICENSE').is_file(), 'GPL license missing')
require((ROOT / 'SOURCES.md').is_file(), 'source credits missing')

# Runtime resources must be local. Ordinary external anchors are user-initiated links.
for tag in re.findall(r'<(?:script|img|link)\b[^>]*>', index):
    if re.search(r'<link\b[^>]*\brel="canonical"', tag):
        continue
    match = re.search(r'(?:src|href)="([^"]+)"', tag)
    if match:
        require(not match.group(1).startswith(('https://', 'http://')),
                f'external runtime resource: {tag}')

for forbidden in ['meet.google.com/', '2089999549', 'BEGIN PRIVATE KEY', 'seed phrase:', '/workspace/vault', '/shared/letters', '/shared/ethglobal-mumbai-2026/dao/CASE-STUDY']:
    require(forbidden not in index, f'forbidden private/internal material in index: {forbidden}')
# Only the twelve specifically disclosed synthetic editorial MP3s are permitted.
# This exception never includes raw meeting audio, voices, transcripts or participant recordings.
narration = load('data/narration.json')
narration_source = load('scripts/narration-source.json')
require(narration['schema'] == 'oso-ai-steward-narration-v1', 'narration must declare editorial AI-steward schema')
require(narration['usage'] == {'autoplay': False, 'defaultEnabled': False, 'preload': 'none', 'runtimeExternalRequests': False}, 'narration must be lazy, local, opt-in and never autoplay')
require(narration['voice']['notHumanRecording'] is True and narration['voice']['authorizedByShaka'] is True, 'narration must be explicitly authorized synthetic speech')
require('AI-agent-steward synthetic narration authorized by Shaka' in index, 'visible player authorization missing')
require('not a live or new recording of Shaka' in index, 'visible no-live/new-human-recording disclosure missing')
require(len(narration['slides']) == 12 and len(narration_source['slides']) == 12, 'narration must cover all twelve movements')
allowed_audio = set()
for n, slide in enumerate(narration['slides'], 1):
    require(slide['id'] == slides[n - 1]['id'], f'narration {n} does not match projector')
    audio = ROOT / slide['audio'].removeprefix('./')
    require(audio.is_file(), f'missing authorized synthetic movement audio: {audio.name}')
    allowed_audio.add(audio.resolve())
    require(slide['audio'].startswith('./assets/narration/audio/'), f'narration audio outside dedicated editorial path: {audio.name}')
    require(slide['bytes'] == audio.stat().st_size, f'measured narration bytes stale: {audio.name}')
    for caption in ['vtt', 'srt']:
        path = ROOT / slide[caption].removeprefix('./')
        require(path.is_file() and slide['text'] in path.read_text(), f'inexact/missing {caption}: {slide["id"]}')
        require(slide[caption].startswith('./assets/narration/captions/'), f'caption outside editorial path: {path.name}')
    require(len(slide['sources']) >= 2, f'insufficient claim-level narration sources: {slide["id"]}')
    for source in slide['sources']:
        require(source['url'].startswith('https://'), f'non-public narration source: {source["url"]}')
        require('meet.google.com' not in source['url'] and 'zoom.us' not in source['url'], f'private meeting source leaked: {source["url"]}')
        require(len(source['claim']) > 20, f'unclear narration claim mapping: {slide["id"]}')
# Meeting #2 (13 November 2026): Shaka confirmed on 2026-11-14 that the recording may be published.
# Exactly one consented mono MP3 of that meeting is permitted, and only in its dedicated route.
import hashlib
meeting2 = load('meetings/2/status.json')
require(meeting2['meeting'] == 2 and meeting2['schema'] == 'oso-dao-proposal-meeting-v1', 'meeting 2 status schema')
require(meeting2['recordingConsent']['status'] == 'confirmed' and meeting2['recordingConsent']['reportedAt'] == '2026-11-14T04:20:00Z', 'meeting 2 consent must be confirmed with its exact date')
require(meeting2['recording']['status'] == 'published_with_consent', 'meeting 2 recording status must be published_with_consent')
require(meeting2['recording']['rawVideo']['hostedOnThisSite'] is False, 'meeting 2 raw video must stay private')
require('proposal' in meeting2['daoStatus'] and 'not on-chain' in meeting2['daoStatus'], 'meeting 2 DAO status must stay a proposal, not on-chain')
require(meeting2['privateMeetLinks'] is None, 'meeting 2 must not publish private Meet links')
m2_audio_rel = meeting2['recording']['publicAudio']
require(m2_audio_rel == '/meetings/2/audio/oso-dao-proposal-meeting-2-2026-11-13.mp3', 'meeting 2 audio must live in its dedicated route')
m2_audio = ROOT / m2_audio_rel.lstrip('/')
require(m2_audio.is_file(), 'meeting 2 consented audio missing')
require(m2_audio.stat().st_size == meeting2['recording']['publicAudioBytes'] and m2_audio.stat().st_size < 90 * 1024 * 1024, 'meeting 2 audio bytes stale or over the 90 MB hosting limit')
require(hashlib.sha256(m2_audio.read_bytes()).hexdigest() == meeting2['recording']['publicAudioSha256'], 'meeting 2 audio SHA-256 mismatch')
allowed_audio.add(m2_audio.resolve())
for rel in ['meetings/2/index.html', 'meetings/2/notes/index.html', 'meetings/2/audio/index.html', 'meetings/2/transcript/index.html', 'meetings/2/transcript/transcript.txt', 'meetings/2/transcript/transcript.vtt', 'meetings/2/transcript/transcript.json']:
    require((ROOT / rel).is_file(), f'meeting 2 route missing: {rel}')
    text = (ROOT / rel).read_text()
    for forbidden in ['meet.google.com', 'drive.google', '18OXbtj', '1ycip3', '2089999549', '@gmail', 'BEGIN PRIVATE KEY', '/workspace/']:
        require(forbidden not in text, f'forbidden private material in {rel}: {forbidden}')
    require(not re.search(r'\b(?:NavPoint|KEW|Brent|Blake)\b', text), f'family-shield material in {rel}')
    for sentence in re.split(r'(?<=[.!?])\s+', re.sub(r'<[^>]+>', ' ', text)):
        if re.search(r'\bDAO\b.{0,40}\b(?:approved|adopted|deployed|launched|live|on-chain)\b|\b(?:approved|adopted|deployed|launched)\s+(?:the\s+)?DAO\b', sentence, re.I):
            require(re.search(r'\b(?:not|never|no|neither|nor|remains?|proposal)\b', sentence, re.I), f'invented DAO adoption claim in {rel}: {sentence[:120]}')
m2_transcript = load('meetings/2/transcript/transcript.json')
require(m2_transcript['meeting'] == 2 and m2_transcript['consent']['status'] == 'published_with_consent', 'meeting 2 transcript consent status')
require(len(m2_transcript['turns']) >= 20 and m2_transcript['stats']['words'] > 5000, 'meeting 2 transcript must be the complete conversation, not an excerpt')
require(all(turn['speaker'] in m2_transcript['speakers'] for turn in m2_transcript['turns']), 'meeting 2 transcript speakers must be declared')
require(m2_transcript['turns'][-1]['end'] <= meeting2['recording']['durationSeconds'] + 1, 'meeting 2 transcript exceeds recording length')
require(meeting2['recording']['durationSeconds'] == 3407.709, 'meeting 2 measured duration must be exact')
sitemap = (ROOT / 'sitemap.xml').read_text()
for route in ['/meetings/2/', '/meetings/2/notes/', '/meetings/2/transcript/', '/meetings/2/audio/']:
    require(f'https://osodaomeet.opensourceorchestra.org{route}</loc>' in sitemap, f'sitemap missing {route}')
require('href="./meetings/2/"' in index, 'hall must link Meeting #2')
require('href="./2/"' in (ROOT / 'meetings/index.html').read_text(), 'meetings index must link Meeting #2')
for path in ROOT.rglob('*.mp3'):
    require(path.resolve() in allowed_audio or path.name == 'oso-dao-proposal-meeting-1-2026-11-12.mp3', f'unexpected recording outside authorized editorial narration or the consented Meeting #1/#2 audio: {path}')
for ext in ['*.mp4', '*.wav', '*.m4a', '*.webm']:
    require(not list(ROOT.rglob(ext)), f'unexpected published recording in the repository (films live off-Pages): {ext}')
require((ROOT / 'narration/index.html').is_file(), 'static narrated transcript missing')
require((ROOT / 'narration/transcript.txt').is_file(), 'plain narrated transcript missing')
require((ROOT / 'narration/narration.vtt').is_file(), 'full-deck VTT missing')
require((ROOT / 'narration/narration.srt').is_file(), 'full-deck SRT missing')

archive = load('archive/status.json')
require(archive['status'] == 'published_with_consent', 'archive must record the consented films as published')
require(archive['recordingConsent']['status'] == 'confirmed', 'Meeting #1 recording consent must be confirmed')
require(archive['recordingConsent']['reportedAt'] == '2026-11-13T05:21:00Z', 'recording consent correction must retain its exact date')
require('broadcast and shared everywhere' in archive['recordingConsent']['scope'], 'full recording broadcast/sharing scope must be explicit')
require('raw originals are not hosted' in archive['mediaAttachment'], 'archive must say the raw originals are not hosted')
require(len(archive['items']) == 3 and [i['channel'] for i in archive['items']] == [1, 2, 3], 'archive must list exactly the three consented films as channels 1–3')
require(all(i['status'] == 'published_with_consent' for i in archive['items']), 'every archive film must be published with consent')
require(archive['meetings']['1']['status'] == 'published_with_consent' and archive['meetings']['1']['transcript'] == '/meetings/1/transcript/', 'archive must list Meeting #1 as published with consent')
require(archive['meetings']['2']['status'] == 'published_with_consent' and archive['meetings']['2']['transcript'] == '/meetings/2/transcript/', 'archive must list Meeting #2 as published with consent')
require(archive['meetings']['weekly-call-2']['status'] == 'published_with_consent', 'archive must list weekly call #2 as published with consent')
require(archive['transcript'] is None and archive['recording'] is None, 'archive top-level attachments stay null; films are listed per meeting')
meeting = load('meetings/1/status.json')
require(meeting['recordingConsent']['status'] == 'confirmed' and meeting['recordingConsent']['reportedAt'] == '2026-11-13T05:21:00Z', 'meeting 1 status must confirm recording consent with its exact date')
require(meeting['recording']['status'] == 'published_with_consent' and meeting['recording']['attachmentStatus'] == 'published_with_consent', 'meeting 1 recording must be published with consent')
require(meeting['recording']['rawTranscript'] is None and meeting['recording']['rawVideo']['hostedOnThisSite'] is False, 'meeting 1 raw transcript and raw video stay private')
require(meeting['recording']['publicUrl'].startswith('https://theater.opensourceorchestra.org/') and re.fullmatch(r'[a-f0-9]{64}', meeting['recording']['publicVideo']['sha256'] or ''), 'meeting 1 film must be on theater.opensourceorchestra.org with SHA-256')
m1_audio = ROOT / meeting['recording']['publicAudio'].lstrip('/')
require(m1_audio.is_file() and m1_audio.stat().st_size == meeting['recording']['publicAudioBytes'] and m1_audio.stat().st_size < 90 * 1024 * 1024, 'meeting 1 audio bytes stale or over the 90 MB hosting limit')
require(hashlib.sha256(m1_audio.read_bytes()).hexdigest() == meeting['recording']['publicAudioSha256'], 'meeting 1 audio SHA-256 mismatch')
allowed_audio.add(m1_audio.resolve())
for rel in ['meetings/1/transcript/index.html', 'meetings/1/transcript/transcript.txt', 'meetings/1/transcript/transcript.vtt', 'meetings/1/transcript/transcript.json', 'meetings/1/audio/index.html', 'channels/index.html', 'meetings/index.html', 'data/channels.json', 'data/garden.json', 'data/transcripts/weekly-call-2.json', 'data/transcripts/weekly-call-2.vtt', 'js/theater.js']:
    require((ROOT / rel).is_file(), f'theater route missing: {rel}')
    text = (ROOT / rel).read_text()
    for forbidden in ['meet.google.com', 'drive.google', '18OXbtj', '1ycip3', '2089999549', '@gmail', 'BEGIN PRIVATE KEY', '/workspace/']:
        require(forbidden not in text, f'forbidden private material in {rel}: {forbidden}')
    require(not re.search(r'\b(?:NavPoint|KEW|Brent|Blake)\b', text), f'family-shield material in {rel}')
    for sentence in re.split(r'(?<=[.!?])\s+', re.sub(r'<[^>]+>', ' ', text)):
        if re.search(r'\bDAO\b.{0,40}\b(?:approved|adopted|deployed|launched|live|on-chain)\b|\b(?:approved|adopted|deployed|launched)\s+(?:the\s+)?DAO\b', sentence, re.I):
            require(re.search(r'\b(?:not|never|no|neither|nor|remains?|proposal)\b', sentence, re.I), f'invented DAO adoption claim in {rel}: {sentence[:120]}')
channels = load('data/channels.json')
require(len(channels['channels']) == 6, 'theater must have six channels')
m2_status = load('meetings/2/status.json')
for ch in channels['channels']:
    if ch['kind'] == 'video':
        require(ch['consent']['status'] == 'published_with_consent' and 'consent' in ch['consent']['line'].lower(), f'channel {ch["number"]} needs consent')
        require(any(ch['media']['video']['url'].startswith(o) for o in channels['mediaOrigins']['video']), f'channel {ch["number"]} film origin not allowed')
        require((ROOT / ch['media']['captions'].removeprefix('./')).is_file(), f'channel {ch["number"]} captions missing')
    if ch['kind'] == 'youtube':
        require(ch['media']['youtubeId'] in ['7IWn-YjNRlk', 'vf3ZitSmXDw'], f'channel {ch["number"]}: only the two verified Shaka-owned YouTube ids')
require(channels['channels'][2]['media']['video']['sha256'] == m2_status['recording']['publicVideo']['sha256'] and channels['channels'][1]['media']['video']['sha256'] == meeting['recording']['publicVideo']['sha256'], 'film hashes must match status JSON')
require('youtube-nocookie.com/embed/' in (ROOT / 'js/theater.js').read_text() and 'autoplay=1' not in (ROOT / 'js/theater.js').read_text(), 'YouTube embeds must be privacy-enhanced and never autoplay')
for route in ['/channels/', '/meetings/1/transcript/', '/meetings/1/audio/']:
    require(f'https://osodaomeet.opensourceorchestra.org{route}</loc>' in sitemap, f'sitemap missing {route}')

nodes = load('data/nodes.json')
circle = (ROOT / 'circle/index.html').read_text()
require(len(nodes['nodes']) == 15, 'all 15 existing public nodes must be present')
require(sum(bool(n.get('image')) for n in nodes['nodes']) == 14, '14 existing public node images must be mirrored')
require(sum(len(n['links']) for n in nodes['nodes']) == 86, 'all 86 public node links must be retained')
require(circle.count('class="node-card"') == 15, '15 static OG cards are required')
require('PUBLIC LINEAGE ≠ DAO MEMBERSHIP' in circle, 'OG non-membership notice must be prominent')
require('Kuba Hejhal · a chair held in remembrance' in circle, 'minimal Kuba remembrance chair missing')
require('first music DIP in Devcon history' not in circle, 'inflated first-music-DIP claim returned')
require('An invited chair · awaiting a personal yes' in circle, 'unnamed consent-gated invited chair missing')
for node in nodes['nodes']:
    if node.get('image'):
        require(node['image']['url'].startswith('/assets/nodes/'), f'node image not localized: {node["slug"]}')
        require((ROOT / node['image']['url'].lstrip('/')).is_file(), f'node image missing: {node["slug"]}')
for tag in re.findall(r'<(?:script|img|link)\b[^>]*>', circle):
    if 'rel="canonical"' in tag:
        continue
    match = re.search(r'(?:src|href)="([^"]+)"', tag)
    if match:
        require(not match.group(1).startswith(('https://', 'http://')), f'OG external runtime resource: {tag}')

if errors:
    print(f'FAIL {len(errors)} release-gate errors across {checks} checks')
    for error in errors:
        print(' -', error)
    raise SystemExit(1)
print(f'PASS {checks} release-gate checks')
print(f'  12 slides · {len(set(all_links))} unique public links · 37 curated media items')
print('  chord spine G–Em–C–D–C–G twice · theater: six channels · Meeting #1 + #2 films/audio/transcripts published with consent · weekly call #2 from archive.org · raw originals private')
