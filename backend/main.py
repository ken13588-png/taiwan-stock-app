from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import stocks, analysis

app = FastAPI(
    title="Taiwan Stock Analysis API",
    description="Backend API for Taiwan Stock Analysis App",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(analysis.router)


@app.get("/")
async def root():
    return {"message": "Taiwan Stock Analysis API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
