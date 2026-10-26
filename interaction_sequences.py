"""Connect preserved Kani frames to normal input without rewriting the frozen base."""
import json

KANI_INPUT_HELP_BEFORE = '마우스로 잡고 놓기 · 터치는 길게 누른 뒤 끌기 · Escape로 놓기. 6자세를 한 번 보여 준 뒤 멈춥니다. 원화는 그대로이며 자연 보행은 아닙니다.'
KANI_INPUT_HELP_AFTER = '카니 전용 무대 · 잡고 놓기는 기본 꺼짐입니다. 켜면 대기 6자세가 반복됩니다. 짧은 터치·클릭 또는 Enter/Space로 읽기 8자세를 한 번 재생한 뒤 대기 6자세 반복으로 돌아갑니다. 마우스·터치는 누른 채 끌거나 길게 눌러 잡기 · 잡는 동안 6자세 반복 · Escape로 잡기 취소. 놓기·낙하·착지는 전용 연속 원화가 없어 정지 자세를 사용합니다. 원화는 그대로이며 자연 보행은 아닙니다.'

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
    if integration.count(KANI_INPUT_HELP_BEFORE)!=1:raise ValueError('Expected one frozen Kani input help')
    integration=integration.replace(before,'onDeliberateInteraction:()=>{p.playKaniPreview("read");return true;}')
    return integration.replace(KANI_INPUT_HELP_BEFORE,KANI_INPUT_HELP_AFTER,1)
