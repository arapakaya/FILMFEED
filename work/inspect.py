import json, re

strings = json.load(open('work/strings.json', encoding='utf-8'))
m = {int(i): v for i, v in strings}

# Full string table
with open('work/strings_all.txt', 'w', encoding='utf-8') as f:
    for i, v in sorted(m.items()):
        f.write(f"{i}\t{v}\n")

deob = open('work/script_4_deob.js', encoding='utf-8').read()

print("=== qgzvfjbf call sites ===")
for mo in re.finditer(r'qgzvfjbf\(', deob):
    i = mo.start()
    print('---', i, ':', deob[max(0, i-450):i+250].replace('\n', ' '))
    print()

print("=== zwjzjnwg def / calls ===")
i = deob.find('async function zwjzjnwg')
print(deob[i:i+2500].replace('\n', ' '))
