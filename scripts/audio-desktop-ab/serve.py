"""Loopback-only review server with byte ranges for synchronous video seeking."""
import argparse,functools,http.server,json,mimetypes,pathlib,re,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[2]
BUILD=ROOT/'.local/qa/desktop-audio-ab-v1/review-build'
class ReviewHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self,url):
        part=urllib.parse.unquote(urllib.parse.urlsplit(url).path)
        choices={'/b2/':ROOT/'.local/audio/godot-b-v2','/b2-source/':ROOT/'source/audio/godot-b-v2/runtime',
                 '/b21-source/':ROOT/'source/audio/godot-b-v2-r1/runtime',
                 '/media/':ROOT/'.local/audio/desktop-ab-v1','/art/':ROOT/'apps/website/public/art',
                 '/source/':ROOT/'source/audio/desktop-ab-v1'}
        for prefix,base in choices.items():
            if part.startswith(prefix):candidate=base/part[len(prefix):];break
        else:base=BUILD;candidate=base/(part.lstrip('/') or 'index.html')
        base=base.resolve();candidate=candidate.resolve()
        return str(candidate if candidate.is_relative_to(base) else base/'__forbidden__')
    def send_head(self):
        path=pathlib.Path(self.translate_path(self.path))
        if not path.is_file():self.send_error(404);return None
        stream=open(path,'rb');size=path.stat().st_size
        match=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers.get('Range',''))
        start,end=(int(match[1]),int(match[2]) if match[2] else size-1) if match else (0,size-1)
        if start>=size or end<start:
            stream.close();self.send_error(416);return None
        end=min(end,size-1);self._remaining=end-start+1
        self.send_response(206 if match else 200)
        self.send_header('Content-Type',mimetypes.guess_type(str(path))[0] or 'application/octet-stream')
        self.send_header('Content-Length',str(self._remaining));self.send_header('Accept-Ranges','bytes')
        self.send_header('Cache-Control','no-cache' if path.suffix in ['.json','.html'] else 'public, max-age=3600')
        if match:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers();stream.seek(start);return stream
    def copyfile(self,source,outputfile):
        try:
            while self._remaining:
                data=source.read(min(131072,self._remaining))
                if not data:break
                outputfile.write(data);self._remaining-=len(data)
        except (ConnectionAbortedError,ConnectionResetError,BrokenPipeError):pass
    def log_message(self,*args):pass
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=5186);args=p.parse_args()
http.server.ThreadingHTTPServer(('127.0.0.1',args.port),ReviewHandler).serve_forever()
