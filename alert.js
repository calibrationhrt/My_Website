export function alertSuccess(title = "สำเร็จ", text = "") {
  return Swal.fire({
    icon: "success",
    title,
    text,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
  });
}

export function alertError(title = "ผิดพลาด", text = "") {
  return Swal.fire({
    icon: "error",
    title,
    text,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2000,
  });
}

export function alertWarning(title = "แจ้งเตือน", text = "") {
  return Swal.fire({
    icon: "warning",
    title,
    text,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2000,
  });
}

export async function confirmDialog(title = "ยืนยัน?", text = "") {
  const result = await Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "ตกลง",
    cancelButtonText: "ยกเลิก",
  });

  return result.isConfirmed;
}