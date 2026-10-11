from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

OUT=Path('docs/music-architecture.pdf')
INK=colors.HexColor('#172033'); BLUE=colors.HexColor('#4055B2'); PALE=colors.HexColor('#EEF1FF'); GREY=colors.HexColor('#65708A')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleX',parent=styles['Title'],fontName='Helvetica-Bold',fontSize=22,leading=26,textColor=INK,spaceAfter=12))
styles.add(ParagraphStyle(name='H1X',parent=styles['Heading1'],fontSize=14,leading=18,textColor=BLUE,spaceBefore=12,spaceAfter=7))
styles.add(ParagraphStyle(name='BodyX',parent=styles['BodyText'],fontSize=9.4,leading=14,textColor=INK,spaceAfter=8))
styles.add(ParagraphStyle(name='SmallX',parent=styles['BodyText'],fontSize=8.2,leading=12,textColor=INK,spaceAfter=5))
styles.add(ParagraphStyle(name='CaptionX',parent=styles['BodyText'],fontSize=8,leading=11,textColor=GREY,alignment=TA_CENTER,spaceAfter=9))
doc=SimpleDocTemplate(str(OUT),pagesize=A4,leftMargin=17*mm,rightMargin=17*mm,topMargin=18*mm,bottomMargin=18*mm)
W=A4[0]-34*mm
story=[]
def title(t):story.append(Paragraph(t,styles['TitleX']))
def head(t):story.append(Paragraph(t,styles['H1X']))
def para(t,small=False):story.append(Paragraph(t,styles['SmallX' if small else 'BodyX']))
def box(d,x,y,w,h,label):
    d.add(Rect(x,y,w,h,rx=6,ry=6,fillColor=PALE,strokeColor=BLUE,strokeWidth=.8))
    d.add(String(x+w/2,y+h/2-3,label,textAnchor='middle',fontName='Helvetica-Bold',fontSize=8,fillColor=INK))
def arrow(d,x1,y1,x2,y2):
    d.add(Line(x1,y1,x2,y2,strokeColor=BLUE,strokeWidth=1.2))
    d.add(Polygon([x2,y2,x2-5,y2+3,x2-5,y2-3],fillColor=BLUE,strokeColor=BLUE))

title('Listen Together — system architecture')
para('Sapien Robotics architecture assignment | 20M monthly users • 2M concurrent listeners • 50M tracks • 200k active rooms')
head('High-level architecture')
d=Drawing(W,190)
for x,y,w,h,l in [(4,130,92,36,'Publisher ingest'),(115,130,92,36,'Encoding + DRM'),(226,130,92,36,'Object storage'),(337,130,92,36,'Multi-CDN'),(337,52,92,36,'Listeners'),(226,52,92,36,'Regional gateways'),(115,52,92,36,'Room leaders'),(4,52,92,36,'Durable event log')]:box(d,x,y,w,h,l)
for a,b,c,e in [(96,148,115,148),(207,148,226,148),(318,148,337,148),(383,130,383,88),(337,70,318,70),(226,70,207,70),(115,70,96,70)]:arrow(d,a,b,c,e)
box(d,4,2,92,30,'History + royalty');box(d,115,2,92,30,'Catalogue DB');box(d,226,2,92,30,'Search index')
arrow(d,50,52,50,32);arrow(d,207,17,226,17)
story.append(d);story.append(Paragraph('Audio flows through CDN; room servers carry control events and timeline anchors only.',styles['CaptionX']))
head('Core decisions and scale')
para('Immutable audio masters and encoded segments live in object storage. The client fetches a short manifest, starts at a conservative bitrate, then adapts. Signed content URLs and DRM enforce rights. At 2M listeners averaging 160 kb/s, estimated audio egress is about 320 Gb/s before overhead; this is a planning estimate, not a measured capacity claim.')
para('Room control is sharded by room ID. Each room has one fenced leader, an epoch and sequence number, replicated hot state, and a durable event log. Regional gateways fan out events. A room of 5,000 listeners does not require 5,000 leader connections.')
story.append(PageBreak())

title('Playback and room synchronization')
head('Pause command in a 5,000-listener room')
lanes=['Host','Gateway','Room leader','Durable log','Fanout','Players']
d=Drawing(W,275); xs=[29,120,211,302,393,484]
for x,l in zip(xs,lanes):
    d.add(String(x,257,l,textAnchor='middle',fontName='Helvetica-Bold',fontSize=8,fillColor=INK));d.add(Line(x,245,x,5,strokeColor=GREY,strokeWidth=.5,strokeDashArray=[3,3]))
steps=[(0,1,'Pause + command ID'),(1,2,'Authorize / route'),(2,3,'Append event'),(3,2,'Commit'),(2,4,'Versioned anchor'),(4,5,'Scheduled pause'),(5,4,'Sampled telemetry')]
for i,(a,b,l) in enumerate(steps):
    y=225-i*31;x1,x2=xs[a],xs[b];d.add(Line(x1,y,x2,y,strokeColor=BLUE,strokeWidth=1.1));direction=1 if x2>x1 else -1;d.add(Polygon([x2,y,x2-5*direction,y+3,x2-5*direction,y-3],fillColor=BLUE,strokeColor=BLUE));d.add(String((x1+x2)/2,y+5,l,textAnchor='middle',fontSize=7,fillColor=INK))
story.append(d);story.append(Paragraph('The room leader acknowledges only after durable commit. Gateways partition fanout.',styles['CaptionX']))
head('Keeping playback within roughly 200 ms')
para('Room state stores track ID, play position at a server timestamp, paused flag, queue, votes, epoch, and sequence. Clients estimate clock offset from repeated ping samples and schedule the anchor in local audio time. Periodic authoritative anchors correct small drift by playback-rate adjustment and large drift by seek. A late joiner fetches snapshot plus subsequent events, buffers audio, then starts at a future anchor.')
para('Measure skew at device audio output, not merely WebSocket delivery. Expected room-event version makes stale pause and seek commands fail. Queue additions are ordered; skip votes are deduplicated by account and track epoch.')
head('Catalogue and storage')
para('Relational storage holds accounts, rights, metadata and playlists; a search index serves typeahead, updated asynchronously through a publication event stream. History is append-oriented and partitioned by user and time. Royalty events enter a durable log with idempotency keys and reconciliation. Analytics consumes a separate stream and cannot block playback.')
story.append(PageBreak())

title('Reliability and failure handling')
cases=[
('Room leader dies','A standby acquires a fenced lease, replays the log, increments epoch, and sends a new snapshot. Old-epoch events are rejected.'),
('Gateway disconnects','Clients reconnect with room ID and last sequence; the new gateway sends missing events or a snapshot.'),
('Regional outage','Traffic shifts to a healthy region. Leaders re-elect from replicated logs; buffered audio continues while control recovers.'),
('CDN segment failure','The player retries another edge or CDN and lowers bitrate; room control is independent.'),
('Search index outage','Known catalogue IDs and playlists still play from metadata storage; typeahead degrades with a visible error.'),
('Event-log pressure','Pause and seek retain priority. Presence and analytics can be sampled or dropped; durable commands are never falsely acknowledged.'),
('Slow listener','The client buffers to a future anchor, reports lag, and seeks to catch up instead of delaying the room.'),
('Rolling deploy','Gateways drain connections and room leaders hand off leases after durable snapshots; clients reconnect by epoch and sequence.'),
]
for label,body in cases:para(f'<b>{label}.</b> {body}')
head('Graceful degradation')
para('If control services are unavailable, a client may continue its buffered track, but must show that room sync is lost and must not apply host controls locally as authoritative. After recovery, it reconciles against the new epoch and anchor.')
story.append(PageBreak())

title('Measurement, tradeoffs and delivery plan')
head('User-visible observability')
para('Track p50/p95/p99 actual playback skew from sampled client audio clocks, rebuffer ratio, start latency, correction rate, late-join catch-up time, command-to-playback delay, room-leader failovers, fanout lag, sequence gaps, CDN segment errors, and royalty-event reconciliation gaps. Run synthetic multi-region room probes continuously. Alert on sustained skew above 200 ms and elevated rebuffering.')
head('Rejected alternatives')
para('<b>Audio through room servers:</b> rejected because egress scales with listeners and should be served by CDNs. <b>One broadcast-only clock:</b> rejected because buffering and output device latency differ. <b>Direct leader-to-listener connections:</b> rejected because rooms can reach 5,000 members. <b>One global relational store for all data:</b> rejected because catalogue, transactions, history and analytics have different write and query patterns.')
head('Three-engineer plan')
rows=[['Stage','Deliverables'],['First vertical slice','Single-region encoded catalogue, CDN playback, room timeline, pause/seek, late join, telemetry, load harness.'],['Reliability pass','Durable event replay, fenced leader failover, queue and skip voting, tested gateway reconnection.'],['Postpone','Active multi-region routing, recommendations, and elaborate social features until sync and failover are measured.']]
t=Table([[Paragraph(x,styles['SmallX']) for x in row] for row in rows],colWidths=[115,W-115],hAlign='LEFT')
t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.7,BLUE),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F7F8FC')]),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
story.append(t)
para('The 200 ms target is an SLO to validate with real devices and regional probes. This document is a design, not a claim that the proposed service has been built or load-tested.')
def footer(c,doc):c.setFont('Helvetica',8);c.setFillColor(GREY);c.drawString(17*mm,12*mm,'Sapien Robotics • Listen Together design');c.drawRightString(A4[0]-17*mm,12*mm,str(doc.page))
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
