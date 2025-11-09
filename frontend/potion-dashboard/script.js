// Generate stars
function generateStars() {
    const starsContainer = document.getElementById('stars-container');
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animation = `twinkle ${2 + Math.random() * 3}s infinite`;
        starsContainer.appendChild(star);
    }
}

// Toggle buttons functionality
const liveToggle = document.getElementById('liveToggle');
const playbackToggle = document.getElementById('playbackToggle');

liveToggle.addEventListener('click', () => {
    liveToggle.classList.add('active');
    playbackToggle.classList.remove('active');
});

playbackToggle.addEventListener('click', () => {
    playbackToggle.classList.add('active');
    liveToggle.classList.remove('active');
});

// Simple chart drawing
function drawChart() {
    const canvas = document.getElementById('forecastChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth - 32;
    const height = 168;
    
    canvas.width = width;
    canvas.height = height;
    
    // Chart data points
    const times = ['10:00', '11:00', '12:00', '14:00', '15:00'];
    const crystal = [75, 72, 70, 68, 65];
    const moonlight = [78, 75, 73, 71, 68];
    const starfire = [73, 70, 68, 66, 63];
    
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const stepX = chartWidth / (times.length - 1);
    
    // Helper function to draw line
    function drawLine(data, color) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        data.forEach((value, index) => {
            const x = padding + index * stepX;
            const y = padding + (100 - value) * (chartHeight / 100);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            // Draw point
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.stroke();
    }
    
    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }
    
    // Draw lines
    drawLine(crystal, '#45D0E5');
    drawLine(moonlight, '#A67DFF');
    drawLine(starfire, '#f59e0b');
    
    // Draw time labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    times.forEach((time, index) => {
        const x = padding + index * stepX;
        ctx.fillText(time, x, height - 5);
    });
}

// Initialize
window.addEventListener('load', () => {
    generateStars();
    drawChart();
});

// Redraw chart on window resize
window.addEventListener('resize', () => {
    drawChart();
});