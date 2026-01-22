// スケジュールデータを格納する変数
let scheduleData = [];
// 現在表示しているカードのインデックス番号
let displayIndex = 0;
// 自動更新モードかどうかのフラグ（スワイプしたらfalseになる）
let isAutoMode = true;

// --- 機能0: データ読み込み ---
async function loadSchedule() {
    console.log("★最新版JS読み込み成功: スワイプ対応版★");
    try {
        const configResp = await fetch("config.json?t=" + new Date().getTime());
        if (!configResp.ok) throw new Error("config.jsonが見つかりません");
        
        const config = await configResp.json();
        const sheetUrl = config.sheetUrl;

        const csvResp = await fetch(sheetUrl + "&t=" + new Date().getTime());
        if (!csvResp.ok) throw new Error(`CSV読込エラー: ${csvResp.status}`);
        
        const text = await csvResp.text();
        const rows = text.trim().split('\n');
        
        scheduleData = rows.map(row => {
            if (!row || row.trim() === "") return null;
            const cleanRow = row.replace(/"/g, ''); 
            const columns = cleanRow.split(',');

            let tIdx = 0;
            if (columns[1] && columns[1].indexOf('2026') > -1) tIdx = 1; 
            if (columns[tIdx] === undefined || columns[tIdx].indexOf('2026') === -1) return null;

            const time = columns[tIdx].trim();
            const title = columns[tIdx + 1] ? columns[tIdx + 1].trim() : "";
            const detail = columns[tIdx + 2] ? columns[tIdx + 2].trim() : "";
            const webDesc = columns[tIdx + 3] ? columns[tIdx + 3].trim() : "";
            const webUrl  = columns[tIdx + 4] ? columns[tIdx + 4].trim() : "";
            const imgDesc = columns[tIdx + 5] ? columns[tIdx + 5].trim() : "";
            const imgUrl  = columns[tIdx + 6] ? columns[tIdx + 6].trim() : "";
            
            return { time, title, detail, webDesc, webUrl, imgDesc, imgUrl };
        }).filter(item => item !== null);

        // 初期表示位置を決定（現在時刻に一番近い未来の予定）
        const now = new Date();
        const nextIdx = scheduleData.findIndex(item => new Date(item.time).getTime() > now.getTime());
        
        if (nextIdx !== -1) {
            displayIndex = nextIdx;
        } else {
            displayIndex = scheduleData.length - 1; // 全部終わってたら最後を表示
        }

        updateTimeKeeper();
        renderScheduleList(); 
        setupSwipe(); // ★スワイプ機能の有効化

    } catch (error) {
        console.error("読込エラー:", error);
        document.getElementById('next-event').innerText = "読込エラー";
    }
}

// --- 機能1: 日程表リストの描画 ---
function renderScheduleList() {
    const container = document.querySelector('#schedule .timeline');
    if (!container || scheduleData.length === 0) return;

    container.innerHTML = '';
    let currentDayStr = "";
    const firstDateObj = new Date(scheduleData[0].time.split(' ')[0]);

    scheduleData.forEach((item, index) => {
        const datePart = item.time.split(' ')[0];
        const timePart = item.time.split(' ')[1] || "";

        if (datePart !== currentDayStr) {
            currentDayStr = datePart;
            const thisDateObj = new Date(datePart);
            const diffTime = Math.abs(thisDateObj - firstDateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            const formattedDate = `${thisDateObj.getMonth() + 1}/${thisDateObj.getDate()}`;
            const dayCard = document.createElement('div');
            dayCard.className = 'day-card';
            dayCard.innerHTML = `<h3>Day ${diffDays} (${formattedDate})</h3><ul></ul>`;
            container.appendChild(dayCard);
        }

        const ul = container.lastElementChild.querySelector('ul');
        const li = document.createElement('li');
        let linkIcon = "";
        if (item.webUrl && item.webUrl.startsWith('http')) {
            linkIcon = ` <a href="${item.webUrl}" target="_blank" style="color:#0055a4; margin-left:5px;"><i class="fas fa-external-link-alt"></i></a>`;
        }
        
        // リストをクリックしてもそのカードに飛べるようにする
        li.innerHTML = `<span class="time">${timePart}</span> ${item.title}${linkIcon}`;
        li.onclick = () => jumpToCard(index); // クリックでジャンプ
        li.style.cursor = "pointer";
        
        ul.appendChild(li);
    });
}

// --- 機能2: タイムキーパー (スワイプ対応版) ---
function updateTimeKeeper() {
    if (scheduleData.length === 0) return;

    // 表示すべきデータ
    const item = scheduleData[displayIndex];
    if (!item) return;

    const now = new Date();
    const eventTime = new Date(item.time);
    const diffMs = eventTime - now; 
    
    // UI要素取得
    const statusLabel = document.getElementById('status-label');
    const nextEventDisplay = document.getElementById('next-event');
    const nextDetailDisplay = document.getElementById('next-detail');
    const timeRemainingDisplay = document.getElementById('time-remaining');
    const cardCounter = document.getElementById('card-counter');

    const webContainer = document.getElementById('web-link-container');
    const webDescDisplay = document.getElementById('web-desc');
    const webLinkBtn = document.getElementById('web-link-btn');
    const webLinkText = document.getElementById('web-link-text');

    const imageContainer = document.getElementById('image-container');
    const imageDescDisplay = document.getElementById('image-desc');
    const mediaContent = document.getElementById('media-content');

    // 初期化
    webContainer.style.display = "none";
    imageContainer.style.display = "none";
    mediaContent.innerHTML = "";

    // ★ステータス表示の分岐
    if (diffMs < 0) {
        statusLabel.innerText = "FINISHED"; // 過去
        statusLabel.style.color = "#ccc";
    } else if (isAutoMode && diffMs > 0) {
        statusLabel.innerText = "NEXT SCHEDULE"; // 次（自動モード時）
        statusLabel.style.color = "white";
    } else {
        statusLabel.innerText = "FUTURE EVENT"; // 未来（手動でめくった時）
        statusLabel.style.color = "#88ccff";
    }

    // テキストセット
    const timeString = item.time.split(' ')[1] || '';
    nextEventDisplay.innerText = `${timeString} ${item.title}`;
    nextDetailDisplay.innerText = item.detail || "";
    cardCounter.innerText = `${displayIndex + 1} / ${scheduleData.length}`; // ページ番号

    // Web情報
    if (item.webUrl && item.webUrl.startsWith('http')) {
        webContainer.style.display = "block";
        webLinkBtn.href = item.webUrl;
        webDescDisplay.innerText = item.webDesc || "Webサイト";
        webLinkText.innerText = "Webサイトを開く";
    }

    // 画像情報
    if (item.imgUrl && item.imgUrl.startsWith('http')) {
        imageContainer.style.display = "block";
        imageDescDisplay.innerText = item.imgDesc || "画像情報";
        const driveMatch = item.imgUrl.match(/\/d\/(.+?)\//);
        let imgSrc = item.imgUrl;
        if (driveMatch) {
            imgSrc = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=s4000`;
        }
        mediaContent.innerHTML = `<img src="${imgSrc}" class="event-image" alt="Event Image" onclick="openModal('${imgSrc}', '${item.imgDesc}')">`;
    }

    // カウントダウン表示（過去の場合は経過時間を表示）
    const absDiffMs = Math.abs(diffMs);
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeText = "";
    if (diffDays > 0) timeText = `${diffDays}日 ${diffHrs}時間`;
    else if (diffHrs > 0) timeText = `${diffHrs}時間 ${diffMins}分`;
    else timeText = `${diffMins}分`;

    if (diffMs < 0) {
        timeRemainingDisplay.innerText = `${timeText} 前`;
        timeRemainingDisplay.style.color = "#ccc";
    } else {
        timeRemainingDisplay.innerText = `あと ${timeText}`;
        timeRemainingDisplay.style.color = (diffMs < 1000 * 60 * 30 && diffDays === 0 && diffHrs === 0) ? "#ff4444" : "#ffd700";
    }
    
    // 矢印の表示制御（最初と最後）
    document.querySelector('.left-arrow').style.display = (displayIndex === 0) ? 'none' : 'block';
    document.querySelector('.right-arrow').style.display = (displayIndex === scheduleData.length - 1) ? 'none' : 'block';
}

// --- 機能3: カード切り替え・スワイプ ---
function changeCard(direction) {
    const newIndex = displayIndex + direction;
    
    // 配列の範囲内かチェック
    if (newIndex >= 0 && newIndex < scheduleData.length) {
        displayIndex = newIndex;
        isAutoMode = false; // 手動操作したら自動モード解除
        
        // アニメーション用クラス付与
        const swipeArea = document.getElementById('swipe-area');
        swipeArea.classList.remove('fade-in');
        void swipeArea.offsetWidth; // リフロー発生
        swipeArea.classList.add('fade-in');

        updateTimeKeeper();
    }
}

function jumpToCard(index) {
    displayIndex = index;
    isAutoMode = false;
    switchTab('home'); // ホームタブに移動
    updateTimeKeeper();
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 上に戻る
}

// タッチイベントの処理
function setupSwipe() {
    const swipeArea = document.getElementById('time-keeper'); // 矢印も含めてスワイプ判定
    let startX = 0;
    let endX = 0;

    swipeArea.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    swipeArea.addEventListener('touchmove', (e) => {
        endX = e.touches[0].clientX;
    }, { passive: true });

    swipeArea.addEventListener('touchend', () => {
        if (startX === 0 || endX === 0) return; // タップの場合は無視
        
        const diff = startX - endX;
        // 50px以上動いたらスワイプとみなす
        if (diff > 50) {
            changeCard(1); // 左へスワイプ＝次のカード（右）へ
        } else if (diff < -50) {
            changeCard(-1); // 右へスワイプ＝前のカード（左）へ
        }
        
        // リセット
        startX = 0;
        endX = 0;
    });
}


// --- 機能4: モーダル (画像拡大) ---
function openModal(src, caption) {
    const modal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-img");
    const captionText = document.getElementById("caption");
    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerText = caption || "";
    modalImg.classList.remove("zoomed");
}

function closeModal() {
    document.getElementById("image-modal").style.display = "none";
}
document.getElementById("modal-img").addEventListener('click', function(e) {
    e.stopPropagation(); 
    this.classList.toggle("zoomed"); 
});

// --- 共通機能 ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(typeof event !== 'undefined' && event.currentTarget) event.currentTarget.classList.add('active');
}

function filterSpots() {
    const input = document.getElementById('searchBox');
    if (!input) return;
    const filter = input.value.toUpperCase();
    const li = document.getElementById('spotList').getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) {
        const text = li[i].textContent || li[i].innerText;
        li[i].style.display = (text.toUpperCase().indexOf(filter) > -1) ? "" : "none";
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadSchedule();
    // 1分ごとの更新（手動モードになっていなければ自動で切り替わる）
    setInterval(() => {
        if (isAutoMode) {
             const now = new Date();
             const nextIdx = scheduleData.findIndex(item => new Date(item.time).getTime() > now.getTime());
             if (nextIdx !== -1 && nextIdx !== displayIndex) {
                 displayIndex = nextIdx; // 時間が経過して次の予定になったら切り替える
             }
        }
        updateTimeKeeper(); // カウントダウン表示の更新
    }, 60000);
});
