import sys

# Reconfigure stdout to use utf-8 to avoid encoding errors in windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '/comments' in line or 'add_ticket_comment' in line or 'trueday.comments' in line:
        print(f"Line {i+1}: {line.strip()}")
        # print 5 lines before and after
        start = max(0, i - 10)
        end = min(len(lines), i + 25)
        print("--- CONTEXT ---")
        for j in range(start, end):
            try:
                print(f"{j+1}: {lines[j]}", end="")
            except Exception as e:
                print(f"{j+1}: [encoding error]")
        print("\n----------------\n")
