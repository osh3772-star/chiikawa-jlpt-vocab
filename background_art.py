"""Exact reviewed source-inspired static wallpapers; not official scene copies."""
import hashlib, struct
EXPECTED = 'be047cc06df705c07d1351733696c416d28ecfbe0f36262f106bb6ddd444bd3f'
STONE_EXPECTED = '6acb5778bc49dbb81bfe118b28f467795a382bbdd6476d3743577393a8e29383'
def load_background_art(root, data_uri):
    result={}
    for identity,sha,label in [
        ('field-ep6',EXPECTED,'EP6 풀밭 모티프'),
        ('stone-ep2',STONE_EXPECTED,'EP2 석조 벽 모티프 · 장소 미확정')]:
        p=root / f'chiikawa-pets/backgrounds/{identity}.png'
        b=p.read_bytes()
        if hashlib.sha256(b).hexdigest()!=sha:
            raise ValueError('Unreviewed background bytes: '+identity)
        if b[:8]!=b'\x89PNG\r\n\x1a\n' or struct.unpack('>II',b[16:24])!=(1536,1024):
            raise ValueError('Background geometry differs from reviewed canvas')
        result[identity]={'id':identity,'source':data_uri(p),'sha256':sha,
            'width':1536,'height':1024,'default':'original','label':label,
            'scope':'static-decorative-wallpaper'}
    return result
