import json
from pathlib import Path

transcript = Path(
    r'C:/Users/needs/.cursor/projects/c-Users-needs-audit-platform/'
    r'agent-transcripts/ce376301-75f1-4475-a477-1de2a9169078/'
    r'ce376301-75f1-4475-a477-1de2a9169078.jsonl'
)


def norm(path: str) -> str:
    return str(Path(path)).replace('\\', '/').lower()


state: dict[str, str] = {}

with transcript.open(encoding='utf-8') as handle:
    for line in handle:
        if 'gp_comparison' not in line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        content = (obj.get('message') or {}).get('content')
        if not isinstance(content, list):
            continue
        for part in content:
            if part.get('type') != 'tool_use':
                continue
            name = part.get('name')
            inp = part.get('input') or {}
            path = inp.get('path')
            if not path or 'gp_comparison' not in path:
                continue
            key = norm(path)
            if name == 'Write' and 'contents' in inp:
                state[key] = inp['contents']
                print('WRITE', Path(path).name, 'len', len(inp['contents']))
            elif name == 'StrReplace' and key in state:
                old, new = inp.get('old_string'), inp.get('new_string')
                if old is None or new is None:
                    continue
                if old not in state[key]:
                    print('MISS', Path(path).name, repr(old[:80]))
                else:
                    state[key] = state[key].replace(old, new, 1)
                    print('OK', Path(path).name)

out_dir = Path(r'C:/Users/needs/audit_platform/python-service')
targets = {
    norm(
        r'c:\Users\needs\audit_platform\python-service\app\engines\financials_engine\engine\gp_comparison.py'
    ): out_dir / '_final_gp_comparison.py',
    norm(
        r'c:\Users\needs\audit_platform\python-service\tests\test_gp_comparison.py'
    ): out_dir / '_final_test_gp_comparison.py',
}
for key, dest in targets.items():
    text = state.get(key)
    if not text:
        print('missing', key)
        continue
    dest.write_text(text, encoding='utf-8')
    print('saved', dest, 'lines', text.count('\n') + 1)
