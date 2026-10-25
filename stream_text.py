"""Bounded-buffer literal substitutions preserving sequential str.replace semantics."""
from pathlib import Path
CHUNK=65536
class StreamText:
    def __init__(self, value, operations=()):
        if not isinstance(value,str): raise TypeError('base must be str')
        self.value=value; self.operations=operations
    def replace(self, old, new):
        if not isinstance(old,str) or not old: raise ValueError('nonempty literal required')
        if not isinstance(new,(str,StreamText)): raise TypeError('replacement must be text')
        return StreamText(self.value,self.operations+((old,new),))
    def chunks(self):
        parts=(self.value[i:i+CHUNK] for i in range(0,len(self.value),CHUNK))
        for old,new in self.operations: parts=replace_chunks(parts,old,new)
        yield from parts
    def write_utf8(self,path):
        with Path(path).open('wb') as out:
            for chunk in self.chunks(): out.write(chunk.encode('utf-8'))
def replacement_chunks(value):
    if isinstance(value,StreamText):yield from value.chunks()
    else:
        for i in range(0,len(value),CHUNK):yield value[i:i+CHUNK]
def replace_chunks(parts,old,new):
    pending='';keep=len(old)-1
    for part in parts:
        pending+=part
        while True:
            index=pending.find(old)
            if index<0:break
            if index:yield pending[:index]
            yield from replacement_chunks(new)
            pending=pending[index+len(old):]
        # Retain enough trailing chars to find a literal spanning two input chunks.
        safe=len(pending)-keep
        if safe>0:yield pending[:safe];pending=pending[safe:]
    if pending:yield pending
