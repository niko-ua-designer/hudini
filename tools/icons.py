# Собирает icons.js: эмодзи пульта → линейные иконки Lucide (npm pack lucide-static, распаковать, передать путь к icons/)
import re, json, os, sys
SRC=sys.argv[1] if len(sys.argv)>1 else 'node_modules/lucide-static/icons'
M={'💬':'message-circle','👁':'eye','✓':'check','📋':'clipboard','🎞':'film','⚡':'zap','🎯':'crosshair','⚠':'triangle-alert','🗑':'trash-2','🙈':'eye-off',
'🧹':'brush-cleaning','🔊':'volume-2','⏸':'pause','💾':'save','➕':'plus','⚙':'settings','⬇':'arrow-down','⬆':'arrow-up','↺':'rotate-ccw','⏹':'square',
'👥':'users','✕':'x','🎛':'sliders-horizontal','❓':'circle-help','🔓':'lock-open','⏱':'hourglass','♻':'recycle','📁':'folder-open','🖼':'image','⏲':'timer',
'🔢':'hash','🎉':'party-popper','📚':'library','🔗':'link','🎬':'clapperboard','👋':'hand','⏳':'hourglass','📅':'calendar','🕐':'clock','📊':'chart-column',
'🎁':'gift','📷':'camera','💥':'sparkles','🎰':'dices','🔒':'lock','★':'star','🔐':'lock-keyhole','✎':'pencil','✏':'pencil','🔑':'key-round','🖱':'mouse-pointer-2',
'⏮':'skip-back','🔁':'repeat','✅':'circle-check','📖':'book-open','📐':'ruler','🆕':'badge-plus','🔍':'search','⛓️‍💥':'unlink','🎄':'tree-pine','✋':'hand',
'🖐':'hand','🖥':'monitor','🏆':'trophy','⚔':'swords','⚖':'scale','🃏':'gallery-horizontal-end','💡':'lightbulb','🔤':'type','⏪':'rewind','⏩':'fast-forward',
'🏠':'house','🌐':'globe','🟣':'circle','⌛':'hourglass','✂':'scissors','↻':'rotate-cw','📍':'map-pin','📌':'pin','🎓':'graduation-cap','⌨':'keyboard',
'🐞':'bug','✨':'sparkles','🌊':'waves','⬅':'arrow-left','🔄':'refresh-cw','▶':'play','🔉':'volume-1','🔇':'volume-x','📺':'tv','🎵':'music','🎤':'mic',
'📸':'camera','🔔':'bell','🧭':'compass','🧩':'puzzle','🪄':'wand-sparkles','📦':'package','🛡':'shield','❤':'heart','💀':'skull','🔥':'flame','🎨':'palette','🖌':'brush',
'🧪':'flask-conical','📝':'notebook-pen','📎':'paperclip','🗂':'folder','🔧':'wrench','🧰':'toolbox','📤':'upload','📥':'download','🔌':'plug','📡':'radio-tower',
'🖨':'printer','💻':'laptop','📱':'smartphone','🗺':'map','🚀':'rocket','⭐':'star','👤':'user','🧑':'user','👑':'crown','🔀':'shuffle','🎲':'dices','💰':'coins','💲':'dollar-sign',
'🙌':'hand-heart','👍':'thumbs-up','👎':'thumbs-down','🚫':'ban','⛔':'ban','❌':'circle-x','✖':'x','⏰':'alarm-clock','📣':'megaphone','📢':'megaphone','🎮':'gamepad-2','🕹':'joystick','🧱':'brick-wall',
'🗒':'sticky-note','🗓':'calendar-days','🏁':'flag','🚩':'flag','🔦':'flashlight','🎚':'sliders-vertical','💫':'sparkle','🌀':'loader','📶':'signal','🧊':'box','🪟':'app-window','🔙':'undo-2'}
icons={}
miss=[]
for e,n in M.items():
    f=f'{SRC}/{n}.svg'
    if not os.path.exists(f): miss.append((e,n)); continue
    s=open(f).read()
    inner=re.search(r'<svg[^>]*>\s*(.*)</svg>', s, re.S).group(1)
    inner=re.sub(r'\s*\n\s*','',inner).replace(' />','/>')
    icons[e]=inner
print('missing',miss, file=sys.stderr)
# свой цилиндр для бренда
icons['🎩']='<path d="M7 4h10l-1 11H8z"/><path d="M8 11h8"/><path d="M2 17.5c0-1.4 4.5-2.5 10-2.5s10 1.1 10 2.5S17.5 20 12 20 2 18.9 2 17.5z"/>'
js='// Линейные иконки вместо эмодзи (наборы Lucide, ISC: icons/LICENSE-lucide). Собирает tools/icons.py\nconst HUDINI_ICONS = '+json.dumps(icons, ensure_ascii=False, separators=(',',':'))+';\n'
p='icons.js'; old=open(p).read() if os.path.exists(p) else ''; rest=old.split('\n',2)[2] if old.count('\n')>=2 else ''; open(p,'w').write(js+rest)
print(len(icons), len(js))
