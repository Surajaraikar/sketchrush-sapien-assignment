from pathlib import Path
import subprocess
import imageio_ffmpeg

base=Path('artifacts/demo')
inputs=[base/f'player-{i}.webm' for i in (1,2,3)]
out=base/'sketchrush-three-player-demo.mp4'
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
cmd=[ffmpeg,'-y']
for path in inputs: cmd.extend(['-i',str(path)])
cmd.extend(['-filter_complex','[0:v]scale=1280:720,setsar=1[host];[1:v]scale=640:360,setsar=1[second];[2:v]scale=640:360,setsar=1[third];[second][third]vstack=inputs=2[guests];[host][guests]hstack=inputs=2[v]','-map','[v]','-t','120','-r','30','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p',str(out)])
subprocess.run(cmd,check=True)
print(out)
