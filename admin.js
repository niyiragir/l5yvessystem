// LOAD USERS (READ)
function loadUsers() {
  fetch("/admin/users")
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("users");
      tbody.innerHTML = "";
      data.forEach(u => {
        tbody.innerHTML += `
          <tr>
            <td><input value="${u.name}" onchange="updateUser(${u.id}, 'name', this.value)"></td>
            <td><input value="${u.email}" onchange="updateUser(${u.id}, 'email', this.value)"></td>
            <td>
              <select onchange="updateUser(${u.id}, 'role', this.value)">
                <option ${u.role==='user'?'selected':''}>user</option>
                <option ${u.role==='admin'?'selected':''}>admin</option>
              </select>
            </td>
            <td>
              <button onclick="deleteUser(${u.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    });
}

// CREATE USER
function createUser() {
  fetch("/admin/create", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      name: name.value,
      email: email.value,
      password: password.value,
      role: role.value
    })
  }).then(() => {
    // clear inputs
    name.value = email.value = password.value = "";
    role.value = "user";
    loadUsers();
  });
}

// UPDATE USER
function updateUser(id, field, value) {
  fetch("/admin/update", {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({id, field, value})
  });
}

// DELETE USER
function deleteUser(id) {
  if (confirm("Are you sure you want to delete this user?")) {
    fetch(`/admin/delete/${id}`, {method: "DELETE"})
      .then(() => loadUsers());
  }
}

// INITIAL LOAD
loadUsers();