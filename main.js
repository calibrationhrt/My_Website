import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";  
import { getFirestore, collection, setDoc, onSnapshot, deleteDoc, doc, getDoc, query, where }from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { alertSuccess, alertError, alertWarning, confirmDialog } from "./alert.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from "./Config.js";

    const app = initializeApp(firebaseConfig); 
    const db = getFirestore(app);

  // STATE
    let deleteMode = false;
    let currentPage = 1;
    const pageSize = 100;
    let statusFilter = "all";
    let currentUser = null;
    const auth = getAuth(app);
    const EIGHT_HOURS = 8 * 60 * 60 * 1000;
    let filteredData = [];

  //Role
  async function loginAdmin() {
    const { value: formValues } = await Swal.fire({
      title: "Login",
      html: `
        <input id="swal-username" class="swal2-input" placeholder="ชื่อผู้ใช้">
        <input id="swal-password" type="password" class="swal2-input" placeholder="รหัสผ่าน">
      `,
      focusConfirm: false,
      preConfirm: () => {
        return {
          username: document.getElementById("swal-username").value,
          password: document.getElementById("swal-password").value
        };
      }
    });

    if (!formValues) return;

      const username = formValues.username.trim().toLowerCase();
      const email = formValues.username + "@gmail.com";
      const password = formValues.password;

      Swal.fire({
        title: "กำลังเข้าสู่ระบบ...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      sessionStorage.setItem("loginTime", Date.now().toString());
      Swal.close(); // ← ปิด popup login ก่อน
      Swal.fire({
        title: "สำเร็จ",
        text: "เข้าสู่ระบบแล้ว",
        icon: "success",
        timer: 1500,        // ← ปิดอัตโนมัติใน 1.5 วิ ไม่ต้องกด OK
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire("ผิดพลาด", "ชื่อหรือรหัสไม่ถูกต้อง", "error");
    }
  } 

  function logout() {
    signOut(auth);
    sessionStorage.removeItem("loginTime");
    Swal.fire("ออกจากระบบสำเร็จ", " ", "success");
}

  onAuthStateChanged(auth, (user) => {
    const addBtn = document.getElementById("add-btn-additem");
    const delBtn = document.getElementById("deleteSelected");

    if (user) {
      // เช็ค 8 ชั่วโมง
      const loginTime = sessionStorage.getItem("loginTime");
      if (loginTime && Date.now() - parseInt(loginTime) > EIGHT_HOURS) {
      signOut(auth);

      sessionStorage.removeItem("loginTime");
      Swal.fire("หมดเวลา", "กรุณาเข้าสู่ระบบใหม่", "warning");
      return;
    }
      // ✅ login แล้ว
      addBtn.style.display = "inline-block";
      delBtn.style.display = "inline-block";

      document.getElementById("adminLoginBtn").style.display = "none";
      document.getElementById("logoutBtn").style.display = "inline-block";

    } else {
      // ❌ ยังไม่ login
      addBtn.style.display = "none";
      delBtn.style.display = "none";

      document.getElementById("adminLoginBtn").style.display = "inline-block";
      document.getElementById("logoutBtn").style.display = "none";
    }
  });

  //Event
  document.getElementById("addItem").addEventListener("click", addItem);
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("add-btn-additem").addEventListener("click", openModal);
  document.getElementById("importBtn").addEventListener("click", importExcel);

  // ปุ่มลบ = เปิดปิดโหมดลบ
  document.getElementById("deleteSelected").addEventListener("click", () => {
    deleteMode = !deleteMode; // toggle

    loadData();
  });

//Import Excel
async function importExcel() {
  const fileInput = document.getElementById("excelFile");
  const file = fileInput.files[0];

  if (!file) {
    alertError("กรุณาเลือกไฟล์ Excel");
    return;
  }

  closeModal(); //ปิดตอนหลังกดปุ่ม import
  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(sheet);

      await uploadToFirebase(jsonData);
    } catch (err) {
      console.error(err);
      alertError("Import ไม่สำเร็จ");
    }
  };
  document.getElementById("excelFile").value = "";
  reader.readAsArrayBuffer(file);
}

function parseExcelDate(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return d.toISOString().split("T")[0];
  }

  if (typeof dateValue === "string") {
    const parts = dateValue.split(/[-\/]/);
    if (parts.length === 3) {
      let [day, month, year] = parts;

      if (year.length === 2) {
        year = "20" + year;
      }

      return `${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
    }
  }

  return null;
}

async function uploadToFirebase(data) {
  for (const item of data) {

    const unitRaw = (item["หน่วย"] || "").toLowerCase().trim();

    let unit;
    if (unitRaw === "days" || unitRaw === "วัน") unit = "days";
    else if (unitRaw === "months" || unitRaw === "เดือน") unit = "months";
    else if (unitRaw === "years" || unitRaw === "ปี") unit = "years";
    else {
      alertError(`❌ หน่วยไม่ถูกต้อง: ${unitRaw}`);
      continue;
    }

    const mapped = {
      name: item["ชื่อเครื่อง"] || item["name"],
      id_tag: item["รหัสเครื่อง"] || item["id_tag"],
      lastDate: parseExcelDate(item["วันที่สอบเทียบล่าสุด"] || item["lastDate"]),
      department: item["แผนก"] || item["department"],
      intervalValue: parseInt(item["รอบสอบเทียบ"] || item["intervalValue"]) || 0,
      intervalUnit: unit
    };

    if (unitRaw === "days" || unitRaw === "วัน") unit = "days";
      else if (unitRaw === "months" || unitRaw === "เดือน") unit = "months";
      else if (unitRaw === "years" || unitRaw === "ปี") unit = "years";
      
    //validation เพิ่ม
    if (!mapped.id_tag) continue;

    if (!mapped.lastDate) {
      alertError(`❌ วันที่ผิด: ${mapped.id_tag}`);
      continue;
    }

    if (!mapped.intervalValue || mapped.intervalValue <= 0) {
      alertError(`❌ interval ผิด: ${mapped.id_tag}`);
      continue;
    }

    const ref = doc(db, "devices", mapped.id_tag);

    const exists = await getDoc(ref);
    if (exists.exists()) continue;

    await setDoc(ref, mapped);
  }

  alertSuccess("นำเข้าข้อมูลสำเร็จ");
}

 function parseInterval(input) {
    const match = input.match(/^(\d+)([dmy])$/i);

    if (!match) return null;

    const value = parseInt(match[1]);
    const unitRaw = match[2].toLowerCase();

    let unit;
    if (unitRaw === "d") unit = "days";
    if (unitRaw === "m") unit = "months";
    if (unitRaw === "y") unit = "years";

    return { value, unit };
  }

//เพิ่มข้อมูล
async function addItem() {
  const name = document.getElementById("name").value.trim();
  const id_tag = document.getElementById("id_tag").value.trim();
  const date = document.getElementById("date").value;
  const department = document.getElementById("department").value;
  const intervalInput = document.getElementById("interval").value.trim();
  const parsed = parseInterval(intervalInput);

  if (!parsed) {
    alertWarning("รูปแบบผิด", "กรุณาใส่ เช่น 1y, 6m, 30d");
    return;
  }

  const value = parsed.value;
  const unit = parsed.unit;

  if (!name || !id_tag || !date || !department || !intervalInput) {
    alertWarning("ข้อมูลไม่ครบ", "กรุณากรอกให้ครบทุกช่อง");
    return;
  }
  closeModal();
  await new Promise(r => setTimeout(r, 100));
  
  const ok = await confirmDialog("ต้องการเพิ่มข้อมูลใช่ไหม?");
  if (!ok) return;  
  closeModal();

  try {
    const ref = doc(db, "devices", id_tag);

    const existingDoc = await getDoc(ref);

    if (existingDoc.exists()) {
      alertError("❌ รหัสเครื่องนี้มีอยู่แล้ว");
      return;
    }
    alertSuccess("เพิ่มข้อมูลสำเร็จ");
    await setDoc(ref, {
      name,
      id_tag,
      lastDate: date,
      department,
      intervalValue: value,
      intervalUnit: unit,
    });
  } catch (err) {
    console.error(err);
    alertError("เกิดข้อผิดพลาด");
  }
}

//Modal
function openModal() {
  document.getElementById("modal").style.display = "flex";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";

  // 🔥 ล้างค่า input
  document.getElementById("name").value = "";
  document.getElementById("id_tag").value = "";
  document.getElementById("date").value = "";
  document.getElementById("department").value = "";
  document.getElementById("interval").value = "";
}

//คำนวณ
function getStatus(dueDate) {
  const today = new Date();
  today.setHours(0,0,0,0);

  const due = new Date(dueDate);
  due.setHours(0,0,0,0);

  const diff = (due - today) / (1000 * 60 * 60 * 24);

  if (diff < 0) return "เกินกำหนด";
  if (diff <= 15) return "ใกล้ถึงกำหนด";
  return "ปกติ";
}

function calculateDueDate(lastDate, value, unit) {
  const d = new Date(lastDate);

  if (unit === "days") {
    d.setDate(d.getDate() + value);
  } else if (unit === "months") {
    d.setMonth(d.getMonth() + value);
  } else if (unit === "years") {
    d.setFullYear(d.getFullYear() + value);
  }

  return d;
}

function showLoading(show) {
  document.getElementById("tableBody").innerHTML =
    show ? "<tr><td colspan='6'>⏳ กำลังโหลด...</td></tr>" : "";
}

//โหลดข้อมูล
    let unsubscribe;
    let allData = [];
    let searchText = "";
    let selectedDept = "all";
    let searchTimeout;

function loadData() {
  showLoading(true);

  if (unsubscribe) unsubscribe();

  let q;

  if (selectedDept === "all") {
  q = collection(db, "devices");
  } else {
  q = query(
    collection(db, "devices"),
    where("department", "==", selectedDept)
  );
}

  unsubscribe = onSnapshot(q, (snapshot) => {
    allData = [];

    snapshot.forEach((docItem) => {
      allData.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    showLoading(false);
    renderTable();
  });
}

//Render ข้อมูล
function renderTable() {
  const table = document.getElementById("tableBody");

  let nearCount = 0;
  let overdueCount = 0;
  let html = "";

  filteredData = allData.filter(d => {

    //กันข้อมูลพัง
    if (!d.lastDate || !d.intervalValue || !d.intervalUnit) return false;

    const name = (d.name || "").toLowerCase();
    const id = (d.id_tag || "").toLowerCase();

    const matchSearch =
      name.includes(searchText) ||
      id.includes(searchText);

    const matchDept =
      selectedDept === "all" || d.department === selectedDept;

    const dueDate = calculateDueDate(d.lastDate, d.intervalValue, d.intervalUnit);
    const status = getStatus(dueDate);

    let matchStatus = true;

    if (statusFilter === "near") {
      matchStatus = status === "ใกล้ถึงกำหนด";
    } else if (statusFilter === "overdue") {
      matchStatus = status === "เกินกำหนด";
    }

    return matchSearch && matchDept && matchStatus;
  });

  // dashboard
  filteredData.forEach((d) => {
    const dueDate = calculateDueDate(d.lastDate, d.intervalValue, d.intervalUnit);
    const status = getStatus(dueDate);

    if (status === "ใกล้ถึงกำหนด") nearCount++;
    if (status === "เกินกำหนด") overdueCount++;
  });

  // pagination
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageData = filteredData.slice(start, end);

  pageData.forEach((d) => {
    const dueDate = calculateDueDate(d.lastDate, d.intervalValue, d.intervalUnit);
    const status = getStatus(dueDate);

    html += `
      <tr data-id="${d.id}">
        <td>
          ${deleteMode ? `<input type="checkbox" class="row-check" value="${d.id}">` : ""}
          ${d.name || "-"}
        </td>
        <td>${d.id_tag || "-"}</td>
        <td>${new Date(d.lastDate).toLocaleDateString("en-GB")}</td>
        <td>${dueDate.toLocaleDateString("en-GB")}</td>
        <td>${d.department || "-"}</td>
        <td>${status}</td>
      </tr>
    `;
  });

  table.innerHTML = html;

  document.getElementById("total").innerText = filteredData.length;
  document.getElementById("nearCount").innerText = nearCount;
  document.getElementById("overdueCount").innerText = overdueCount;

  const maxPage = Math.ceil(filteredData.length / pageSize);
  document.getElementById("pageInfo").innerText =
    `Page ${currentPage} / ${maxPage}`;

  document.getElementById("prevPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === maxPage;

  toggleConfirmButton();
}

document.getElementById("tableBody").addEventListener("click", (e) => {
  const row = e.target.closest("tr");
    if (!row) return;

    if (e.target.classList.contains("row-check")) return;

    const id = row.getAttribute("data-id");
    openDetail(id);
  });

function closeDetail() {
    document.getElementById("detailModal").style.display = "none";
}

    document.getElementById("closeDetailBtn").addEventListener("click", closeDetail);

  window.addEventListener("click", (e) => {
    const modal = document.getElementById("detailModal");
    if (e.target === modal) {
      closeDetail();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });

function openDetail(id) {
  const item = allData.find(d => d.id === id);

  if (!item) return;

  const dueDate = calculateDueDate(item.lastDate,item.intervalValue,item.intervalUnit);
  const status = getStatus(dueDate);

  document.getElementById("detailContent").innerHTML = `
  <div class="detail-grid">

    <div class="label">ชื่อเครื่อง  :</div>
    <div class="value box">${item.name}</div>

    <div class="label">รหัสเครื่อง  :</div>
    <div class="value box">${item.id_tag}</div>

    <div class="label">สอบเทียบล่าสุด  :</div>
    <div class="value box">${new Date(item.lastDate).toLocaleDateString("en-GB")}</div>

    <div class="label">สอบเทียบครั้งถัดไป  :</div>
    <div class="value box">${dueDate.toLocaleDateString("en-GB")}</div>

    <div class="label">แผนก  :</div>
    <div class="value box dept">${item.department}</div>

    <div class="label">สถานะ  :</div>
    <div class="value status ${status}">${status}</div>

  </div>
`;

  document.getElementById("detailModal").style.display = "flex";
}

function setActiveCard(id) {
  document.querySelectorAll(".card").forEach(c => c.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

//สร้างปุ่ม confirm ถ้ายังไม่มี
function toggleConfirmButton() {
  let btn = document.getElementById("confirmDelete");

  if (!btn) {
    btn = document.createElement("button");
    btn.id = "confirmDelete";
    btn.innerText = "✅ ยืนยันลบ";
    btn.className = "delete-btn";

    document.querySelector(".btn-add-del").appendChild(btn);

    btn.addEventListener("click", deleteSelected);
  }

  btn.style.display = deleteMode ? "inline-block" : "none";
}

//ลบรายการ
async function deleteSelected() {
  const selected = document.querySelectorAll(".row-check:checked");

  if (selected.length === 0) {
    alertWarning("กรุณาเลือกข้อมูล");
    return;
  }

  const ok = await confirmDialog("ต้องการลบข้อมูลใช่ไหม");
  if (!ok) return;
  
  for (let cb of selected) {
    await deleteDoc(doc(db, "devices", cb.value));
  }
  alertSuccess("ลบข้อมูลสำเร็จ")

  deleteMode = false; //ปิดโหมด
  loadData();
}

  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchText = e.target.value.toLowerCase();
      currentPage = 1;
      renderTable();
    }, 300); // หน่วง 0.3 วิ ลดค้าง
  });
  document.getElementById("filterDept").addEventListener("change", (e) => {
  selectedDept = e.target.value;
       currentPage = 1;
      loadData();
  });

  //Next / Prev logic
  document.getElementById("prevPage").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
  });
  document.getElementById("nextPage").addEventListener("click", () => {
  const maxPage = Math.ceil(filteredData.length / pageSize);
  if (currentPage < maxPage) {
    currentPage++;
    renderTable();
  }
  });

  //Dasboard
  document.getElementById("cardNear").addEventListener("click", () => {
  statusFilter = "near";
  currentPage = 1;
  setActiveCard("cardNear");
  renderTable();
  });
  document.getElementById("cardOverdue").addEventListener("click", () => {
  statusFilter = "overdue";
  currentPage = 1;
  setActiveCard("cardOverdue");
  renderTable();
  });
  document.getElementById("cardAll").addEventListener("click", () => {
  statusFilter = "all";
  currentPage = 1;
  setActiveCard("cardAll");
  renderTable();
  });
  // Role
  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("adminLoginBtn").addEventListener("click", loginAdmin);
    document.getElementById("logoutBtn").addEventListener("click", logout);
  });
  
  flatpickr("#date", {
  dateFormat: "Y-m-d",
  allowInput: true,
  static: true
  });

// start
  loadData();
