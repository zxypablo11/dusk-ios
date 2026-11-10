"""Editable Figma design revision: language, settings, theme collection and editor."""
from pathlib import Path
import subprocess
from render import *

PALETTES = [
 ('Graphite','#131416','#202125','#2B2D32','#C0C5E8'),
 ('Obsidian','#000000','#111214','#24262A','#E1E3E8'),
 ('Cobalt','#10151E','#1B2331','#273347','#A6C6FF'),
 ('Violet','#17141D','#252030','#342C40','#CDB6F2'),
 ('Ember','#191512','#29221E','#3A2E27','#ECBB96'),
 ('Ice','#10191C','#1B292D','#27393D','#A1D9DC')]

def header(title, back=True):
 b = icon('chevron', 20,61,20,SECONDARY) if back else mark(22,59,24)
 if back:b=f'<g transform="translate(60 0) scale(-1 1)">{b}</g>'
 return b+text(53,80,'Dusk' if not back else title,18,600,spacing=-.4)

def nav():
 b=box(0,760,390,63,BACKGROUND)
 for x,name,label in [(65,'compass','Entdecken'),(195,'library','Sammlung'),(325,'search','Suche')]:
  b+=icon(name,x-11,774,22,SECONDARY)+text(x,811,label,10,color=SECONDARY,align='middle')
 return b

def row(y,title,subtitle='',value='',symbol='chevron'):
 b=text(37,y+28,title,15,500)
 if subtitle:b+=text(37,y+49,subtitle,11,color=SECONDARY)
 if value:b+=text(332,y+29,value,12,color=SECONDARY,align='end')
 if symbol:b+=icon(symbol,341,y+13,18,SECONDARY)
 return b

def settings():
 b=header('',False)+text(22,134,'Einstellungen',29,600,spacing=-.8)
 b+=box(20,158,350,46,SURFACE,13)+icon('search',34,171,18,SECONDARY)+text(64,187,'Einstellungen durchsuchen',13,color=SECONDARY)
 b+=box(20,224,350,76,SURFACE,16)+row(229,'Sprache','Deutsch · Englisch','System')
 b+=text(24,331,'Deine App',16,600)
 b+=box(20,347,350,270,SURFACE,16)
 for i,(title,sub) in enumerate([('Darstellung','Themes, Schrift, Layout'),('Wiedergabe','Qualität, Übergänge, Sleep-Timer'),('Bibliothek & Downloads','Offline-Musik und Speicher'),('Profile & Synchronisierung','Deine Musik auf deinen Geräten')]):
  y=350+i*66
  b+=row(y,title,sub)
  if i<3:b+=box(37,y+62,316,1,ELEVATED)
 b+=box(20,636,350,57,SURFACE,16)+row(640,'Erweitert')
 b+=mark(22,717,19)+text(49,733,'Dusk',13,600)+text(366,733,'Ganz nach dir.',12,color=SECONDARY,align='end')
 return shell('Dusk-Settings-v2',b+nav())

def themes():
 b=header('Darstellung')+text(22,135,'Dein Dusk',29,600,spacing=-.8)
 b+=text(22,165,'Dunkle Flächen. Dein Akzent.',14,color=SECONDARY)
 for i,(name,bg,sf,hi,ac) in enumerate(PALETTES):
  x=20+(i%2)*181;y=190+(i//2)*145
  b+=box(x,y,169,132,SURFACE,14,ACCENT if i==0 else None)
  b+=box(x+7,y+7,155,84,bg,9)
  b+=box(x+19,y+19,44,44,sf,7)+box(x+72,y+22,68,6,ac,3)+box(x+72,y+36,47,5,'#A9ABB3',2)+box(x+19,y+73,122,3,hi,1)+box(x+19,y+73,46,3,ac,1)
  b+=text(x+12,y+114,name,14,500)
  if i==0:b+=circle(x+147,y+108,8,ACCENT)+f'<path d="M{x+143} {y+108}l3 3 5-6" stroke="{BACKGROUND}" stroke-width="1.5" fill="none"/>'
 b+=box(20,642,350,48,ACCENT,14)+text(195,672,'Eigenes Theme erstellen',14,600,BACKGROUND,align='middle')
 b+=box(20,702,169,44,SURFACE,12)+text(104,730,'Importieren',13,500,align='middle')
 b+=box(201,702,169,44,SURFACE,12)+text(285,730,'Meine Themes',13,500,align='middle')
 return shell('Dusk-Themes-v2',b+nav())

def editor():
 b=header('Theme bearbeiten')+text(364,80,'Fertig',13,500,ACCENT,'end')
 b+=box(20,111,350,152,'#10151E',17,'#273347')+mark(36,126,21)+text(65,144,'Dusk',15,600)
 b+=box(34,159,322,73,'#1B2331',12)+art('after-hours',45,170,50,radius=8)
 b+=text(109,190,'Dein Abendmix',15,600)+text(109,212,'Für dich zusammengestellt',11,color=SECONDARY)+icon('play',319,184,18,'#A6C6FF')
 b+=box(36,248,318,3,'#273347',2)+box(36,248,115,3,'#A6C6FF',2)
 b+=text(24,298,'Theme-Name',12,color=SECONDARY)+box(20,310,350,46,SURFACE,12)+text(34,339,'Nightfall',15,500)
 b+=text(24,391,'Farben',17,600)
 for x,y,label,c in [(24,412,'Hintergrund','#10151E'),(205,412,'Flächen','#1B2331'),(24,466,'Akzent','#A6C6FF'),(205,466,'Text','#F5F5F7')]:
  b+=box(x,y,37,37,c,9,'#616773')+text(x+48,y+23,label,12)
 b+=text(24,544,'Schriftgröße',15,500)+text(366,544,'100 %',12,color=SECONDARY,align='end')
 b+=box(24,565,342,4,ELEVATED,2)+box(24,565,133,4,ACCENT,2)+circle(157,567,9,ACCENT)
 b+=text(24,612,'Rundungen',15,500)+text(366,612,'16 pt',12,color=SECONDARY,align='end')
 b+=box(24,633,342,4,ELEVATED,2)+box(24,633,171,4,ACCENT,2)+circle(195,635,9,ACCENT)
 b+=box(20,668,350,53,SURFACE,13)+row(670,'Startseite anpassen')
 b+=text(195,752,'Die Vorschau bleibt bis zum Speichern lokal.',11,color=SECONDARY,align='middle')
 b+=box(20,773,350,44,ACCENT,14)+text(195,801,'Speichern und anwenden',14,600,BACKGROUND,'middle')
 return shell('Dusk-Theme-Editor-v2',b)

def main():
 screens=[('dusk-home-v2','Entdecken',home()),('dusk-settings','Einstellungen',settings()),('dusk-themes','Themes',themes()),('dusk-editor','Eigene Themes',editor())]
 board=box(0,0,1792,1052,'#1B1C20')+mark(32,26,24)+text(65,48,'Dusk',23,600,spacing=-.5)
 board+=text(1758,47,'Personalisierung · iPhone 14 · DE / EN',13,color=SECONDARY,align='end')
 for i,(file,label,content) in enumerate(screens):
  x=32+i*438
  board+=text(x,100,label,14,500,color=SECONDARY)+f'<g transform="translate({x} 122)">{content}</g>'
  (ROOT/(file+'.svg')).write_text(svg(content,390,844))
  subprocess.run(['convert','-background',BACKGROUND,str(ROOT/(file+'.svg')),str(ROOT/(file+'.png'))],check=True)
 board+=text(32,1017,'Kleines Horizontzeichen. Ruhiger Schriftzug. Sechs dunkle Farbwelten.',13,color=SECONDARY)
 (ROOT/'dusk-personalization.svg').write_text(svg(board,1792,1052))
 subprocess.run(['convert','-background','#1B1C20',str(ROOT/'dusk-personalization.svg'),str(ROOT/'dusk-personalization.png')],check=True)
 print(ROOT/'dusk-personalization.png')
if __name__=='__main__':main()
