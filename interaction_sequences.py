"""Connect preserved Kani frames to normal input without rewriting the frozen base."""
import json

def adapt_kani_interactions(integration,root):
    marker='const inputEngine='
    if integration.count(marker)!=1:raise ValueError('Expected one isolated Kani input engine')
    start=integration.index(marker)+len(marker)
    current,length=json.JSONDecoder().raw_decode(integration[start:])
    if not isinstance(current,str) or not current.startswith('export function createKaniPresentation('):
        raise ValueError('Unexpected frozen Kani input engine')
    if not integration[start+length:].startswith(',inputCss='):
        raise ValueError('Unexpected frozen Kani input engine boundary')
    engine=(root/'chiikawa-pets/kani-input-engine.js').read_text(encoding='utf-8')
    replacement=json.dumps(engine,ensure_ascii=False).replace('<','\\u003c')
    integration=integration[:start]+replacement+integration[start+length:]
    before='onDeliberateInteraction:()=>true'
    if integration.count(before)!=1:raise ValueError('Expected one frozen Kani tap bridge')
    return integration.replace(before,'onDeliberateInteraction:()=>{p.playKaniPreview("read");return true;}')
