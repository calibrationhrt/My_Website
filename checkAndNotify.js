import axios from "axios";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// 🔥 config เดิมของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyCI0J3GHKFl9lmVwOM03stAxwvHHkYFHEM",
  authDomain: "calibration-bcc66.firebaseapp.com",
  projectId: "calibration-bcc66",
  storageBucket: "calibration-bcc66.firebasestorage.app",
  messagingSenderId: "156162245790",
  appId: "1:156162245790:web:09d71d12511176410d278f",
  measurementId: "G-EK23GYH3FL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 LINE
const ACCESS_TOKEN = process.env.LINE_TOKEN || "K/06f3u1qxssTn0eN8pALzRzykbAhdUgpRcXpmASLN3/6q6ouOOyLZVY+twCfpbezxK2DOorsuzJz2fFLUNjvz8a44/lMqfv0P0Gus1OT0pnRax46UFTrYdY77j+wk+kEQn3y47vAL0/ZU45ymGPegdB04t89/1O/w1cDnyilFU=";
const GROUP_ID = process.env.GROUP_ID || "Cf32b7901d6a41722b42aeab74c3e2ef0";

// 🔥 ฟังก์ชันคำนวณ
function getStatus(dueDate) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const due = new Date(dueDate);
  due.setHours(0,0,0,0);

  const diff = (due - today) / (1000 * 60 * 60 * 24);

  if (diff < 0) return "overdue";
  if (diff <= 15) return "near";
  return "normal";
}

function calculateDueDate(lastDate, value, unit) {
  const d = new Date(lastDate);

  if (unit === "days") d.setDate(d.getDate() + value);
  if (unit === "months") d.setMonth(d.getMonth() + value);
  if (unit === "years") d.setFullYear(d.getFullYear() + value);

  return d;
}

function getDiffDays(dueDate) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const due = new Date(dueDate);
  due.setHours(0,0,0,0);

  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

// 🚀 main
async function run() {
  const snapshot = await getDocs(collection(db, "devices"));

  let nearList = [];
  let overdueList = [];

  for (const docItem of snapshot.docs) {
    const d = docItem.data();

    if (!d.lastDate) continue;

    const dueDate = calculateDueDate(d.lastDate, d.intervalValue, d.intervalUnit);
    const status = getStatus(dueDate);

    const diff = getDiffDays(dueDate);

    const itemData = {
    text: `${d.name} (${d.id_tag})
    📅 ${dueDate.toLocaleDateString("th-TH")} (${diff} วัน)`,
    diff
    };

    if (status === "near") nearList.push(itemData);
    if (status === "overdue") overdueList.push(itemData);
  }

  // ❗ ถ้าไม่มีอะไรเลย ไม่ต้องส่ง
  if (nearList.length === 0 && overdueList.length === 0) {
    console.log("ไม่มีรายการแจ้งเตือน");
    return;
  }

    // เรียงจากใกล้สุด → ไกลสุด
    nearList.sort((a, b) => a.diff - b.diff);
    overdueList.sort((a, b) => a.diff - b.diff);

    // กันข้อความยาวเกิน
    overdueList = overdueList.slice(0, 20);
    nearList = nearList.slice(0, 20);

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
        
      to: GROUP_ID,
      messages: [
        {
        type: "flex",
        altText: "แจ้งเตือนสอบเทียบ",
        contents: {
            type: "bubble",
            body: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: "📢 Calibration Alert",
                    weight: "bold",
                    size: "md"
                },
                {
                    type: "separator",
                    margin: "md"
                },
                {
                    type: "text",
                    text: "🔴 เกินกำหนด",
                    weight: "bold",
                    margin: "sm",
                    color: "#f12424"
                },
                ...overdueList.map(item => ({
                    type: "box",
                    layout: "vertical",
                    margin: "sm",
                    backgroundColor: "#FCEAEA", // 🔴 จางลง
                    cornerRadius: "5px",
                    paddingAll: "4px",
                    contents: [
                        {
                        type: "text",
                        text: `${item.text.split("\n")[0]}`,
                        weight: "bold",
                        size: "xxs",
                        wrap: true,
                        maxLines: 2
                        },
                        {
                        type: "text",
                        text: item.text.split("\n")[1],
                        size: "xxs",
                        color: "#555555",
                        },
                    ]
                })),

                {
                    type: "text",
                    text: "🟡 ใกล้ครบกำหนด",
                    weight: "bold",
                    margin: "sm",
                    color: "#FFA500"
                },
                ...nearList.map(item => ({
                    type: "box",
                    layout: "vertical",
                    margin: "sm",
                    backgroundColor: "#FFF7E6", // 🔴 จางลง
                    cornerRadius: "5px",
                    paddingAll: "4px",
                    contents: [
                        {
                        type: "text",
                        text: `${item.text.split("\n")[0]}`,
                        weight: "bold",
                        size: "xxs",
                        wrap: true,
                        maxLines: 2
                        },
                        {
                        type: "text",
                        text: item.text.split("\n")[1],
                        size: "xxs",
                        color: "#555555",
                        },
                    ]
                }))
            ]
            }
        }
        }
        ]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    }
  );

  console.log("ส่งสรุปเรียบร้อย");
}

run();