from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import csv
import os
from datetime import datetime

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# WebSocket 연결 관리를 위한 클래스
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

# 게시글 모델
class Post(BaseModel):
    id: int
    title: str
    content: str
    group: str
    created_at: str
    urgent: bool = False
    completed: bool = False

class PostCreate(BaseModel):
    title: str
    content: str
    group: str
    urgent: bool = False
    completed: bool = False

# 게시글 업데이트 모델
class PostUpdate(BaseModel):
    urgent: Optional[bool] = None
    completed: Optional[bool] = None

# CSV 파일 경로
CSV_FILE = "posts.csv"

# CSV 파일이 없으면 생성
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "title", "content", "group", "created_at", "urgent", "completed"])

def read_posts(group: Optional[str] = None) -> List[Post]:
    posts = []
    with open(CSV_FILE, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if group is None or group == "" or row["group"] == group or row["group"] == "":
                posts.append(Post(
                    id=int(row["id"]),
                    title=row["title"],
                    content=row["content"],
                    group=row["group"],
                    created_at=row["created_at"],
                    urgent=row.get("urgent", "False").lower() == "true",
                    completed=row.get("completed", "False").lower() == "true"
                ))
    # Sort posts by urgency first, then by creation time in descending order
    posts.sort(key=lambda x: (not x.urgent, x.created_at), reverse=True)
    return posts

def write_post(post: Post) -> None:
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            post.id,
            post.title,
            post.content,
            post.group,
            post.created_at,
            post.urgent,
            post.completed
        ])

def delete_post(post_id: int) -> None:
    posts = read_posts()
    posts = [p for p in posts if p.id != post_id]
    
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "title", "content", "group", "created_at", "urgent", "completed"])
        for post in posts:
            writer.writerow([
                post.id,
                post.title,
                post.content,
                post.group,
                post.created_at,
                post.urgent,
                post.completed
            ])

def get_next_id() -> int:
    posts = read_posts()
    if not posts:
        return 1
    return max(p.id for p in posts) + 1

@app.get("/")
async def root():
    return {"message": "게시판 API 서버입니다."}

@app.get("/groups")
async def get_groups():
    return {"groups": ["PAD", "CMP", "WSS"]}

@app.get("/posts")
async def get_posts(group: Optional[str] = None):
    return read_posts(group)

@app.post("/posts")
async def create_post(post: PostCreate):
    new_post = Post(
        id=get_next_id(),
        title=post.title,
        content=post.content,
        group=post.group,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        urgent=post.urgent,
        completed=post.completed
    )
    write_post(new_post)
    await manager.broadcast({
        "type": "new_post",
        "post": new_post.model_dump()
    })
    return new_post

@app.delete("/posts/{post_id}")
async def delete_post_endpoint(post_id: int):
    delete_post(post_id)
    await manager.broadcast({
        "type": "delete_post",
        "post_id": post_id
    })
    return {"message": "Post deleted"}

@app.put("/posts/{post_id}")
async def update_post(post_id: int, post_update: PostUpdate):
    posts = read_posts()
    post_to_update = next((p for p in posts if p.id == post_id), None)
    if not post_to_update:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Update only the provided fields
    if post_update.urgent is not None:
        post_to_update.urgent = post_update.urgent
    if post_update.completed is not None:
        post_to_update.completed = post_update.completed
    
    # Delete the old post and write the updated one
    delete_post(post_id)
    write_post(post_to_update)
    
    await manager.broadcast({
        "type": "update_post",
        "post": post_to_update.model_dump()
    })
    return post_to_update

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # 초기 연결 시 모든 게시물 전송
        posts = read_posts()
        await websocket.send_json({
            "type": "initial_posts",
            "posts": [post.model_dump() for post in posts]
        })

        while True:
            data = await websocket.receive_json()
            if data["type"] == "get_posts":
                group = data.get("group")
                posts = read_posts(group)
                await websocket.send_json({
                    "type": "initial_posts",
                    "posts": [post.model_dump() for post in posts]
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 