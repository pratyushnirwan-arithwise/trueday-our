import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('../my-vite-app/src/EditTicket.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'onKeyDown' in line:
        print(f"Line {i+1}: {line.strip()}")
        # print 5 lines before and after
        start = max(0, i - 5)
        end = min(len(lines), i + 10)
        print("--- CONTEXT ---")
        for j in range(start, end):
            try:
                print(f"{j+1}: {lines[j]}", end="")
            except Exception as e:
                print(f"{j+1}: [encoding error]")
        print("\n----------------\n")
