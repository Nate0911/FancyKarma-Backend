<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FancyKarma | System Ready</title>
    <style>
        body { background: #050505; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; overflow: hidden; font-family: sans-serif; }
        .card { background: #121212; padding: 30px; border-radius: 20px; text-align: center; border: 1px solid #222; width: 320px; }
        
        /* Locked Font for Buttons */
        button { 
            font-family: 'Verdana', sans-serif !important; 
            background: #FF4500; color: white; border: none; padding: 12px 25px; 
            border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%;
        }

        /* Status Dot Animation */
        .dot { height: 8px; width: 8px; background: #00ff00; border-radius: 50%; display: inline-block; margin-right: 8px; box-shadow: 0 0 10px #00ff00; animation: blink 1.5s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        
        .status-text { color: #888; font-size: 12px; margin-bottom: 20px; }
        video { border-radius: 10px; margin-bottom: 15px; width: 100%; }
    </style>
</head>
<body>
    <div class="card">
        <video autoplay loop muted playsinline><source src="https://i.imgur.com/SVGjM9E.mp4" type="video/mp4"></video>
        <div class="status-text"><span class="dot"></span> SYSTEM READY</div>
        <button onclick="startAuth()">VERIFY KARMA</button>
    </div>

    <script>
        function startAuth() {
            const clientID = 'u8MeOBIFfObKKRsdmExg_w';
            const redirect = encodeURIComponent('https://nate0911.github.io/Fancykarma/redirect.html');
            // 'identity' scope is all we need for karma/age
            window.location.href = `https://www.reddit.com/api/v1/authorize?client_id=${clientID}&response_type=code&state=fancy&redirect_uri=${redirect}&duration=temporary&scope=identity`;
        }
    </script>
</body>
</html>
