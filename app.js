// 상수 정의
const API_ENDPOINTS = {
  POSTS: "/posts",
  GROUPS: "/groups",
  WS: "ws://localhost:8000/ws",
};

const MESSAGE_TYPES = {
  INITIAL_POSTS: "initial_posts",
  NEW_POST: "new_post",
  UPDATE_POST: "update_post",
  DELETE_POST: "delete_post",
  GET_POSTS: "get_posts",
};

const UI_ELEMENTS = {
  SEARCH_INPUT: "search-input",
  GROUP_SELECT: "group-select",
  BOARD_CONTENT: "board-content",
  CONNECTION_STATUS: "connection-status",
  OPACITY_INPUT: "opacity",
  VERTICAL_TOGGLE: "vertical-toggle",
  POSITION_TOGGLE: "position-toggle",
  FILTER_BUTTONS: {
    ALL: "showAllButton",
    COMPLETED: "showCompletedButton",
    INCOMPLETED: "showIncompleteButton",
  },
};

const DEFAULT_OPACITY = 80;

// 게시판 관리 클래스
class BoardManager {
  constructor() {
    this.ws = null;
    this.groups = [];
    this.posts = [];
    this.currentGroup = "";
    this.searchQuery = "";
    this.currentFilter = "all";
    this.isVerticalExpanded = true;
    this.currentPosition = "left";
    this.deletePostId = null;
    this.editPostId = null;

    this.initialize();
  }

  initialize() {
    this.initializeWebSocket();
    this.loadGroups();
    this.setupEventListeners();
    this.setupInitialState();
  }

  setupInitialState() {
    this.updateOpacity(DEFAULT_OPACITY);
    this.updateFilterButtons();
    this.updateToggleButtons();
  }

  initializeWebSocket() {
    this.ws = new WebSocket(API_ENDPOINTS.WS);
    this.ws.onmessage = (event) => this.handleWebSocketMessage(event);
    this.ws.onclose = () => this.handleWebSocketClose();
    this.ws.onerror = (error) => this.handleWebSocketError(error);
  }

  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.processWebSocketData(data);
    } catch (error) {
      console.error("WebSocket 메시지 처리 중 오류:", error);
    }
  }

  processWebSocketData(data) {
    switch (data.type) {
      case MESSAGE_TYPES.INITIAL_POSTS:
        this.posts = data.posts;
        this.renderPosts();
        break;
      case MESSAGE_TYPES.NEW_POST:
        this.posts.unshift(data.post);
        this.renderPosts();
        break;
      case MESSAGE_TYPES.UPDATE_POST:
        this.updatePostInList(data.post);
        break;
      case MESSAGE_TYPES.DELETE_POST:
        this.removePostFromList(data.post_id);
        break;
    }
  }

  handleWebSocketClose() {
    this.updateConnectionStatus(false);
    setTimeout(() => this.initializeWebSocket(), 1000);
  }

  handleWebSocketError(error) {
    console.error("WebSocket 오류:", error);
    this.updateConnectionStatus(false);
  }

  updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById(
      UI_ELEMENTS.CONNECTION_STATUS
    );
    statusElement.classList.toggle("connected", isConnected);
  }

  async loadGroups() {
    try {
      const response = await fetch(API_ENDPOINTS.GROUPS);
      if (!response.ok) throw new Error("그룹 목록을 불러오는데 실패했습니다.");

      const data = await response.json();
      this.groups = data.groups;
      this.renderGroupSelector();
    } catch (error) {
      console.error("그룹 로딩 오류:", error);
      alert("그룹 목록을 불러오는데 실패했습니다.");
    }
  }

  renderGroupSelector() {
    const selector = document.getElementById(UI_ELEMENTS.GROUP_SELECT);
    selector.innerHTML = '<option value="">전체</option>';

    this.groups.forEach((group) => {
      if (group) {
        const option = document.createElement("option");
        option.value = group;
        option.textContent = group;
        selector.appendChild(option);
      }
    });
  }

  setupEventListeners() {
    this.setupSearchListener();
    this.setupGroupFilterListener();
    this.setupFilterButtonListeners();
    this.setupWindowControlListeners();
    this.setupPostFormListeners();
    this.setupCSVDownloadListener();
  }

  setupSearchListener() {
    document
      .getElementById(UI_ELEMENTS.SEARCH_INPUT)
      .addEventListener("input", (e) => {
        this.searchQuery = e.target.value;
        this.renderPosts();
      });
  }

  setupGroupFilterListener() {
    document
      .getElementById(UI_ELEMENTS.GROUP_SELECT)
      .addEventListener("change", (e) => {
        this.currentGroup = e.target.value;
        this.renderPosts();
      });
  }

  setupFilterButtonListeners() {
    Object.entries(UI_ELEMENTS.FILTER_BUTTONS).forEach(([key, id]) => {
      document.getElementById(id).addEventListener("click", () => {
        this.currentFilter = key.toLowerCase();
        this.updateFilterButtons();
        this.renderPosts();
      });
    });
  }

  setupWindowControlListeners() {
    document
      .getElementById(UI_ELEMENTS.OPACITY_INPUT)
      .addEventListener("input", (e) => {
        this.updateOpacity(e.target.value);
      });

    document
      .getElementById(UI_ELEMENTS.VERTICAL_TOGGLE)
      .addEventListener("click", () => {
        this.toggleVertical();
      });

    document
      .getElementById(UI_ELEMENTS.POSITION_TOGGLE)
      .addEventListener("click", () => {
        this.togglePosition();
      });
  }

  setupPostFormListeners() {
    // 게시글 작성 폼 이벤트 리스너 설정
    document.getElementById("post-form").addEventListener("submit", (e) => {
      e.preventDefault();
      this.createPost();
    });
  }

  setupCSVDownloadListener() {
    console.log("Setting up CSV download listener...");
    const downloadButton = document.getElementById("download-csv");
    console.log("Download button element:", downloadButton);

    if (!downloadButton) {
      console.error("Download button not found!");
      return;
    }

    downloadButton.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Download button clicked!");
      alert("다운로드 버튼이 클릭되었습니다!");
    });
  }

  updateFilterButtons() {
    const buttons = document.querySelectorAll(".filter-button");
    buttons.forEach((button) => button.classList.remove("active"));

    const activeButtonId = `show${
      this.currentFilter.charAt(0).toUpperCase() + this.currentFilter.slice(1)
    }Button`;
    document.getElementById(activeButtonId).classList.add("active");
  }

  updateOpacity(value) {
    const opacity = value / 100;
    const elements = [
      ".content",
      ".post-form",
      ".post",
      ".header",
      ".search-container",
    ];

    elements.forEach((selector) => {
      document.querySelector(selector).style.opacity = opacity;
    });
  }

  toggleVertical() {
    this.isVerticalExpanded = !this.isVerticalExpanded;
    const verticalToggle = document.getElementById(UI_ELEMENTS.VERTICAL_TOGGLE);
    verticalToggle.textContent = this.isVerticalExpanded
      ? "expand_more"
      : "expand_less";

    const content = document.querySelector(".content");
    content.style.height = this.isVerticalExpanded ? "100vh" : "auto";

    const { ipcRenderer } = require("electron");
    ipcRenderer.send("toggle-vertical", this.isVerticalExpanded);
  }

  togglePosition() {
    this.currentPosition = this.currentPosition === "left" ? "right" : "left";
    const positionToggle = document.getElementById(UI_ELEMENTS.POSITION_TOGGLE);
    const content = document.querySelector(".content");

    // 애니메이션을 위한 클래스 추가/제거
    content.classList.remove("left", "right");
    content.classList.add(this.currentPosition);

    // 위치 변경 애니메이션
    content.style.transform =
      this.currentPosition === "left"
        ? "translateX(0)"
        : "translateX(calc(100vw - 100%))";

    positionToggle.textContent =
      this.currentPosition === "left" ? "chevron_right" : "chevron_left";

    const { ipcRenderer } = require("electron");
    ipcRenderer.send("change-position", this.currentPosition);
  }

  updateToggleButtons() {
    const verticalToggle = document.getElementById(UI_ELEMENTS.VERTICAL_TOGGLE);
    const positionToggle = document.getElementById(UI_ELEMENTS.POSITION_TOGGLE);

    verticalToggle.textContent = this.isVerticalExpanded
      ? "expand_more"
      : "expand_less";
    positionToggle.textContent =
      this.currentPosition === "left" ? "chevron_right" : "chevron_left";
  }

  renderPosts() {
    const filteredPosts = this.filterPosts();
    const container = document.getElementById(UI_ELEMENTS.BOARD_CONTENT);
    container.innerHTML = filteredPosts
      .map((post) => this.createPostElement(post))
      .join("");
  }

  filterPosts() {
    return this.posts
      .filter((post) => {
        const matchesGroup =
          !this.currentGroup || post.group === this.currentGroup;
        const matchesSearch =
          !this.searchQuery ||
          post.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          post.content.toLowerCase().includes(this.searchQuery.toLowerCase());
        const matchesFilter =
          this.currentFilter === "all" ||
          (this.currentFilter === "completed" && post.completed) ||
          (this.currentFilter === "incomplete" && !post.completed);

        return matchesGroup && matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return 0;
      });
  }

  createPostElement(post) {
    return `
      <div class="post ${post.urgent ? "urgent" : ""} ${
      post.completed ? "post-completed" : ""
    }">
        <div class="post-header">
          <div class="post-status">
            <label class="checkbox-label">
              <input type="checkbox" class="urgent-checkbox" ${
                post.urgent ? "checked" : ""
              } 
                onchange="boardManager.updatePostStatus(${
                  post.id
                }, 'urgent', this.checked)">
              긴급
            </label>
            <label class="checkbox-label">
              <input type="checkbox" class="completed-checkbox" ${
                post.completed ? "checked" : ""
              }
                onchange="boardManager.updatePostStatus(${
                  post.id
                }, 'completed', this.checked)">
              완료
            </label>
          </div>
          ${post.group ? `<div class="post-group">${post.group}</div>` : ""}
        </div>
        <div class="post-title">${post.title}</div>
        <div class="post-content">${post.content}</div>
        <div class="post-footer">
          <div class="post-time">${post.created_at}</div>
          <button class="delete-button" onclick="boardManager.deletePost(${
            post.id
          })">X</button>
        </div>
      </div>
    `;
  }

  async createPost() {
    const titleInput = document.getElementById("new-title");
    const contentInput = document.getElementById("new-content");
    const groupInput = document.getElementById("new-group");
    const urgentInput = document.getElementById("new-urgent");

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const group = groupInput.value.trim();
    const urgent = urgentInput.checked;

    if (!title) {
      alert("제목을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.POSTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          group,
          urgent,
          completed: false,
        }),
      });

      if (!response.ok) {
        throw new Error("게시글 작성에 실패했습니다.");
      }

      titleInput.value = "";
      contentInput.value = "";
      urgentInput.checked = false;
    } catch (error) {
      console.error("게시글 작성 오류:", error);
      alert(error.message);
    }
  }

  async updatePostStatus(postId, field, value) {
    try {
      const response = await fetch(`${API_ENDPOINTS.POSTS}/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error("게시글 상태 업데이트에 실패했습니다.");
      }
    } catch (error) {
      console.error("게시글 상태 업데이트 오류:", error);
      alert(error.message);
    }
  }

  async deletePost(postId) {
    if (!confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.POSTS}/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("게시글 삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("게시글 삭제 오류:", error);
      alert(error.message);
    }
  }

  updatePostInList(updatedPost) {
    const index = this.posts.findIndex((post) => post.id === updatedPost.id);
    if (index !== -1) {
      this.posts[index] = updatedPost;
      this.renderPosts();
    }
  }

  removePostFromList(postId) {
    this.posts = this.posts.filter((post) => post.id !== postId);
    this.renderPosts();
  }
}

// 앱 초기화
document.addEventListener("DOMContentLoaded", () => {
  window.boardManager = new BoardManager();
});
