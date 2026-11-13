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
for path in ROOT.rglob('*.mp3'):
    require(path.resolve() in allowed_audio, f'unexpected recording outside authorized editorial narration: {path}')
for ext in ['*.mp4', '*.wav', '*.m4a', '*.webm']:
    require(not list(ROOT.rglob(ext)), f'unexpected published recording: {ext}')
require((ROOT / 'narration/index.html').is_file(), 'static narrated transcript missing')
require((ROOT / 'narration/transcript.txt').is_file(), 'plain narrated transcript missing')
require((ROOT / 'narration/narration.vtt').is_file(), 'full-deck VTT missing')
require((ROOT / 'narration/narration.srt').is_file(), 'full-deck SRT missing')

archive = load('archive/status.json')
require(archive['status'] == 'consent_confirmed_media_not_attached', 'archive must distinguish confirmed recording consent from unattached media')
require(archive['recordingConsent']['status'] == 'confirmed', 'Meeting #1 recording consent must be confirmed')
require(archive['recordingConsent']['reportedAt'] == '2026-11-13T05:21:00Z', 'recording consent correction must retain its exact date')
require('broadcast and shared everywhere' in archive['recordingConsent']['scope'], 'full recording broadcast/sharing scope must be explicit')
require('not attached or hosted' in archive['mediaAttachment'], 'archive must not imply that raw video is attached or hosted')
require(archive['fullParticipantTranscript'].startswith('not released; not separately addressed'), 'full participant transcript must remain unreleased and unaddressed by the correction')
require(archive['items'] == [], 'archive must contain no downloadable items in this status-only update')
require(archive['transcript'] is None and archive['recording'] is None, 'archive media attachments must remain null')
meeting = load('meetings/1/status.json')
require(meeting['recordingConsent']['status'] == 'confirmed', 'meeting status must confirm recording consent')
require(meeting['recording']['attachmentStatus'] == 'not_attached_to_this_site', 'meeting status must keep raw media unattached')
require(meeting['recording']['publicUrl'] is None and meeting['recording']['publicDownload'] is None, 'meeting status must not invent a recording URL or download')
require(meeting['recording']['rawTranscript'] is None, 'meeting status must not release a full raw transcript')

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
print('  chord spine G–Em–C–D–C–G twice · recording consent confirmed · no raw media attached')
