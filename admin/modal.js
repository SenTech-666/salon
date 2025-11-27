// admin/modal.js
let currentServiceId = null;

export function setCurrentServiceId(id) {
  currentServiceId = id || null;
}

export function openServiceModal() {
  document.getElementById("service-modal").style.display = "flex";
}

export function closeServiceModal() {
  document.getElementById("service-modal").style.display = "none";
  setCurrentServiceId(null);
}

export async function saveService(db, onSuccess) {
  const name = document.getElementById("service-name").value.trim();
  const price = Number(document.getElementById("service-price").value);
  const duration = Number(document.getElementById("service-duration").value);

  if (!name || isNaN(price) || isNaN(duration)) return alert("Заполните все поля правильно");

  const data = { name, price, duration };

  if (currentServiceId) {
    await updateDoc(doc(db, "services", currentServiceId), data);
  } else {
    await addDoc(collection(db, "services"), data);
  }

  onSuccess();
}