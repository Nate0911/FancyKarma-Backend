<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><title>Verifying...</title>
  <style>
    body { background: #0b0b0b; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
    .loader { border: 4px solid #333; border-top: 4px solid #FF4500; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="box"><div class="loader"></div><p>Checking Eligibility...</p></div>
  <script>
    async function start() {
      const code = new URLSearchParams(window.location.search).get('code');
      try {
        const res = await fetch('https://fancykarma-backend.onrender.com/auth', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ code: code, redirect_uri: "https://nate0911.github.io/Fancykarma/redirect.html" })
        });
        const data = await res.json();
        if(data.status === 'pass') {
          window.location.href = `index.html?status=pass&r=${data.task.rowIndex}&c=${encodeURIComponent(data.task.comment)}&u=${encodeURIComponent(data.task.postUrl)}`;
        } else {
          document.getElementById('box').innerHTML = `<h3 style="color:#FF4500">❌ Requirement Fail</h3><p>${data.reason}</p>`;
        }
      } catch(e) { document.getElementById('box').innerText = "❌ Server Error"; }
    }
    start();
  </script>
</body>
</html>
