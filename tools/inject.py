# Подключает к каждому материалу (materials/<раздел>/<id>/index.html) общий блок сайта сразу после <body>:
#   кнопка «← MIRAÉ» в кабинет, подстановка логина и PIN в поля материала и мост js/bridge.js
#   (время занятий и отчёты «Отправить учителю» попадают в запись ученика и в панель преподавателя).
# Запуск из корня сайта: python3 tools/inject.py   — повторный запуск ничего не дублирует.
import glob, os, re

MARK = '<!--mirae-inject-->'
BRIDGE = '<script src="../../../js/bridge.js"></script>'
BACK = ('<a href="../../../cabinet.html" style="position:fixed;top:8px;left:8px;z-index:99999;background:#0B1535;color:#D4AF7C;'
        'padding:6px 12px;border-radius:999px;font:600 13px system-ui;text-decoration:none;opacity:.92">← MIRAÉ</a>')
FILL = ('<script>try{var u=localStorage.getItem("kr_user"),p=localStorage.getItem("kr_pin");var f=function(){var n=document.getElementById("nameInput"),'
         'q=document.getElementById("pinInput");if(n&&u&&!n.value){n.value=u}if(q&&p&&!q.value){q.value=p}};f();'
        'document.addEventListener("DOMContentLoaded",f)}catch(e){}</script>')

changed = []
for path in sorted(glob.glob('materials/*/*/index.html')):
    s = open(path, encoding='utf8').read()
    if BRIDGE in s:
        continue
    if MARK in s:
        s = s.replace(MARK, MARK + BRIDGE, 1)
    else:
        m = re.search(r'<body[^>]*>', s)
        if not m:
            print('нет <body>:', path)
            continue
        # кнопка «← MIRAÉ» нужна, только если страница сама не ведёт обратно на сайт
        back = '' if 'href="../../../' in s or 'href="../../../../' in s else BACK
        s = s[:m.end()] + MARK + BRIDGE + back + FILL + s[m.end():]
    open(path, 'w', encoding='utf8').write(s)
    changed.append(path)
print('обновлено:', len(changed))
for p in changed:
    print(' ', os.path.dirname(p))
