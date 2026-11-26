const form = document.querySelector("form");
const reminder = document.querySelector("#reminder");
const list = document.querySelector("ul");
const error = document.querySelector("#reminder-error");

if (!form || !(reminder instanceof HTMLInputElement) || !list || !error) {
  throw new Error("Missing reminder form controls");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = reminder.value.trim();
  if (text === "") {
    error.textContent = "Enter a reminder.";
    reminder.setAttribute("aria-invalid", "true");
    reminder.focus();
    return;
  }

  const item = document.createElement("li");
  item.textContent = text;
  list.append(item);
  form.reset();
  error.textContent = "";
  reminder.removeAttribute("aria-invalid");
  reminder.focus();
});
