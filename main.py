from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from gradio_client import Client
import shutil, os, uuid, asyncio
from concurrent.futures import ThreadPoolExecutor

app = FastAPI()

os.makedirs("static", exist_ok=True)
os.makedirs("generated", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

client = Client("tencent/SongGeneration", httpx_kwargs={"timeout": 300})
executor = ThreadPoolExecutor(max_workers=2)

class GenerationRequest(BaseModel):
    lyrics: str
    description: str = ""
    genre: str = "Auto"
    cfg_coef: float = 1.8
    temperature: float = 0.8


def call_hf_api(req: GenerationRequest):
    return client.predict(
        lyric=req.lyrics,
        description=req.description if req.description else None,
        prompt_audio=None,
        genre=req.genre,
        cfg_coef=req.cfg_coef,
        temperature=req.temperature,
        api_name="/generate_song"
    )


@app.post("/api/generate")
async def generate_music(req: GenerationRequest):
    try:
        if not req.lyrics or len(req.lyrics.strip()) == 0:
            raise HTTPException(status_code=400, detail="Lyrics cannot be empty")

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(executor, call_hf_api, req)

        audio_filepath = None
        if isinstance(result, tuple) and len(result) > 0:
            audio_filepath = result[0]
        elif isinstance(result, str):
            audio_filepath = result
        elif isinstance(result, list) and len(result) > 0:
            audio_filepath = result[0]

        if not audio_filepath or not os.path.exists(audio_filepath):
            raise Exception("No audio file returned from the API.")

        unique_name = f"{uuid.uuid4()}.flac"
        shutil.copy(audio_filepath, os.path.join("generated", unique_name))

        return {"success": True, "audio_url": f"/api/audio/{unique_name}"}

    except HTTPException:
        raise
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    file_path = os.path.join("generated", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="audio/flac")
    raise HTTPException(status_code=404, detail="Audio file not found")


@app.get("/")
def read_root():
    return FileResponse("static/index.html")
