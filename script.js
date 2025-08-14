// ==== API KEY ====
const OPENWEATHER_API_KEY = "67f024104b882616002b62e47b5bcd16";

// ==== WEST BENGAL CITIES & Other States ====
const STATES = {
  "West Bengal": ["Kolkata","Howrah","Durgapur","Siliguri","Asansol","Bardhaman","Malda","Kharagpur"],
  "Kerala": ["Thiruvananthapuram","Kochi","Kozhikode","Thrissur","Alappuzha","Palakkad","Kannur","Kollam","Malappuram","Kottayam","Idukki"],
  "Assam": ["Guwahati","Silchar","Dibrugarh","Jorhat","Nagaon","Tezpur"],
  "Bihar": ["Patna","Gaya","Bhagalpur","Muzaffarpur","Purnia","Darbhanga"],
  "Punjab": ["Amritsar","Ludhiana","Jalandhar","Patiala","Bathinda","Chandigarh"],
  "Rajasthan": ["Jaipur","Jodhpur","Udaipur","Kota","Bikaner","Ajmer"],
  "Gujarat": ["Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar","Gandhinagar"],
  "Mizoram": ["Aizawl","Lunglei","Serchhip","Champhai","Kolasib","Mamit","Saiha","Lawngtlai"],
  "Tripura": ["Agartala","Udaipur","Dharmanagar","Kailashahar"],
  "Karnataka": ["Bengaluru","Mysuru","Mangalore","Hubli","Belgaum","Davangere"],
  "Maharashtra": ["Mumbai","Pune","Nagpur","Nashik","Aurangabad","Thane"]
};

// ==== Helpers ====
const $  = (q) => document.querySelector(q);

function fmtDateLocal(ts, tzShift) {
  // Show city-local date using UTC renderer trick
  return new Date((ts + tzShift) * 1000).toLocaleDateString([], {
    weekday:'long', month:'long', day:'numeric', timeZone: 'UTC'
  });
}

function fmtTimeLocal(ts, tzShift) {
  // ts is in UTC seconds; tzShift is seconds offset from UTC for the city
  // Add shift, then render as UTC so output equals city-local wall time
  return new Date((ts + tzShift) * 1000).toLocaleTimeString([], {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC"
  });
}

function dayShort(ts){
  // Use browser TZ only for labels that don't need exact wall time
  return new Date(ts * 1000).toLocaleDateString([], { day:'2-digit', month:'short' }).toUpperCase();
}

// Live clock (city timezone)
function startClock(timezoneOffsetSeconds) {
  function updateClock() {
    // Date.now() is already UTC ms, no need to add local offset
    const utcMs = Date.now();
    // Shift into city-local ms by adding the timezone offset in milliseconds
    const cityMs = utcMs + timezoneOffsetSeconds * 1000;
    // Render as UTC => shows city-local wall time
    $("#localTime").textContent = new Date(cityMs).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC"
    });
  }
  updateClock();
  clearInterval(startClock._id);
  startClock._id = setInterval(updateClock, 1000);
}

// Temperature unit (Celsius by default)
let tempUnit = "C";
function convertTemp(celsius) {
  return tempUnit === "C" ? celsius : (celsius * 9/5) + 32;
}

// ==== Sidebar build ====
const stateList = document.getElementById("stateList");
(function buildSidebar(){
  for (const [state, cities] of Object.entries(STATES)) {
    const li = document.createElement("li");
    li.className = "acc-item open";
    li.innerHTML = `
      <button class="acc-btn">${state} <span class="chev">▶</span></button>
      <div class="acc-panel">
        ${cities.map(c => `<a href="#" data-city="${c}" data-state="${state}">${c}</a>`).join("")}
      </div>
    `;
    stateList.appendChild(li);
  }
})();
stateList.addEventListener("click", (e) => {
  const btn = e.target.closest(".acc-btn");
  if (btn) btn.parentElement.classList.toggle("open");
  const link = e.target.closest("a[data-city]");
  if (link) {
    e.preventDefault();
    loadByCity(link.dataset.city, "IN");
  }
});

// ==== Search ====
$("#searchBtn").addEventListener("click", () => {
  const q = $("#searchInput").value.trim();
  if (q) loadByCity(q);
});
$("#searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const q = $("#searchInput").value.trim();
    if (q) loadByCity(q);
  }
});

// ==== API Calls ====
async function fetchCurrent(city, country){
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(country ? city + "," + country : city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Current weather fetch failed");
  return r.json();
}
async function fetchForecast(city, country){
  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(country ? city + "," + country : city)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Forecast fetch failed");
  return r.json();
}

// ==== Variables & State ====
let tempChart;
let forecastView = "daily"; // or "hourly"
let cityTZ = 0; // current city's timezone shift in seconds

// ==== Render ====
function renderAll({ current, forecast }) {
  cityTZ = current.timezone || 0;

  $("#cityChip").textContent = `${current.name}, ${current.sys.country}`;
  $("#dateChip").textContent = fmtDateLocal(current.dt, cityTZ);

  // Sunset & Sunrise in city-local time
  $("#sunset").textContent = `🌇 ${fmtTimeLocal(current.sys.sunset, cityTZ)}`;
  $("#sunriseTomorrow").textContent = `🌅 ${fmtTimeLocal(current.sys.sunrise, cityTZ)}`;

  // Live city time + weather
  $("#moonrise").innerHTML = `<span id="localTime"></span> 🕒`;
  $("#moonset").textContent = `${getWeatherEmoji(current.weather[0].main)} ${current.weather[0].main}`;
  startClock(cityTZ);

  // Overview stats
  $("#overviewStats").innerHTML = `
    <div class="stat"><div class="label">Temperature</div><div class="value">${convertTemp(current.main.temp).toFixed(1)}°${tempUnit}</div></div>
    <div class="stat"><div class="label">Humidity</div><div class="value">${current.main.humidity}%</div></div>
    <div class="stat"><div class="label">Wind Speed</div><div class="value">${current.wind.speed} m/s</div></div>
    <div class="stat"><div class="label">Condition</div><div class="value">${current.weather[0].description}</div></div>
  `;

  renderForecast(forecast);
  renderChart(forecast);
}

// Weather emoji mapping
function getWeatherEmoji(condition) {
  const map = {
    Clear: "☀️",
    Clouds: "☁️",
    Rain: "🌧️",
    Drizzle: "🌦️",
    Thunderstorm: "⛈️",
    Snow: "❄️",
    Mist: "🌫️",
    Smoke: "💨",
    Haze: "🌫️",
    Dust: "🌪️",
    Fog: "🌫️",
    Sand: "🌪️",
    Ash: "🌋",
    Squall: "💨",
    Tornado: "🌪️"
  };
  return map[condition] || "";
}

// ==== Forecast Rendering ====
function renderForecast(forecast) {
  if (forecastView === "daily") {
    const dailyData = {};
    forecast.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (item.dt_txt.includes("12:00:00") && !dailyData[date]) dailyData[date] = item;
    });
    const dailyList = Object.values(dailyData).slice(0, 5);

    $("#forecast").innerHTML = dailyList.map(d => `
      <div class="fcard">
        <div class="fdate">${dayShort(d.dt)}</div>
        <div class="fmain">
          <img class="icon" src="https://openweathermap.org/img/wn/${d.weather[0].icon}.png" alt="">
          <div>
            <div><strong>${Math.round(convertTemp(d.main.temp_max))}°</strong> <span class="fdesc">${Math.round(convertTemp(d.main.temp_min))}°</span></div>
            <div class="fdesc">Humidity ${d.main.humidity}%</div>
          </div>
        </div>
        <div class="fdesc">${d.weather[0].description}</div>
      </div>
    `).join("");
  } else {
    const nextHours = forecast.list.slice(0, 8);
    $("#forecast").innerHTML = nextHours.map(h => `
      <div class="fcard">
        <div class="fdate">${fmtTimeLocal(h.dt, cityTZ)}</div>
        <div class="fmain">
          <img class="icon" src="https://openweathermap.org/img/wn/${h.weather[0].icon}.png" alt="">
          <div>
            <div><strong>${Math.round(convertTemp(h.main.temp))}°</strong></div>
            <div class="fdesc">Humidity ${h.main.humidity}%</div>
          </div>
        </div>
        <div class="fdesc">${h.weather[0].description}</div>
      </div>
    `).join("");
  }
}

// ==== Chart Rendering ====
function renderChart(forecast) {
  let dataSetMax = [], dataSetMin = [], labels = [];

  if (forecastView === "daily") {
    const dailyTemps = {};
    forecast.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!dailyTemps[date]) dailyTemps[date] = { max: -Infinity, min: Infinity, dt: item.dt };
      dailyTemps[date].max = Math.max(dailyTemps[date].max, item.main.temp_max);
      dailyTemps[date].min = Math.min(dailyTemps[date].min, item.main.temp_min);
    });
    const sortedDates = Object.keys(dailyTemps).sort().slice(0,5);
    labels = sortedDates.map(date => dayShort(dailyTemps[date].dt));
    dataSetMax = sortedDates.map(date => convertTemp(dailyTemps[date].max));
    dataSetMin = sortedDates.map(date => convertTemp(dailyTemps[date].min));

    const datasets = [
      { label:"Max Temp", data:dataSetMax, borderColor:"rgba(220, 38, 38, 0.9)", backgroundColor:"rgba(220, 38, 38, 0.2)", tension:0.35, fill:true, pointRadius:4, pointHoverRadius:6 },
      { label:"Min Temp", data:dataSetMin, borderColor:"rgba(59, 130, 246, 0.9)", backgroundColor:"rgba(59, 130, 246, 0.2)", tension:0.35, fill:true, pointRadius:4, pointHoverRadius:6 }
    ];
    updateChart(labels, datasets);
  } else {
    const nextHours = forecast.list.slice(0, 8);
    labels = nextHours.map(h => fmtTimeLocal(h.dt, cityTZ));
    const temps = nextHours.map(h => convertTemp(h.main.temp));
    const datasets = [{ label:"Temperature", data:temps, borderColor:"rgba(34, 197, 94, 0.9)", backgroundColor:"rgba(34, 197, 94, 0.2)", tension:0.35, fill:true, pointRadius:4, pointHoverRadius:6 }];
    updateChart(labels, datasets);
  }
}

function updateChart(labels, datasets) {
  const ctx = document.getElementById("tempChart").getContext("2d");
  if (tempChart) tempChart.destroy();
  tempChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive:true,
      plugins:{ legend:{ display:true, position:"top" } },
      scales:{ y:{ title:{ display:true, text:`Temperature (°${tempUnit})` }, beginAtZero:false } }
    }
  });
}

// ==== Loader ====
async function loadByCity(city, country){
  try {
    document.body.style.cursor = "progress";
    const current = await fetchCurrent(city, country);
    const forecast = await fetchForecast(city, country);
    renderAll({ current, forecast });
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    document.body.style.cursor = "default";
  }
}

// ==== Toggle Buttons ====
// Celsius / Fahrenheit
$("#toggleUnit").addEventListener("click", () => {
  tempUnit = (tempUnit==="C")?"F":"C";
  $("#toggleUnit").textContent = tempUnit==="C"?"Show °F":"Show °C";
  const cityCountry = $("#cityChip").textContent.split(",").map(s=>s.trim());
  if(cityCountry.length===2) loadByCity(cityCountry[0], cityCountry[1]);
});

// Daily / Hourly
$("#toggleView").addEventListener("click", () => {
  forecastView = (forecastView==="daily")?"hourly":"daily";
  $("#toggleView").textContent = forecastView==="daily"?"Show Hourly":"Show Daily";
  const cityCountry = $("#cityChip").textContent.split(",").map(s=>s.trim());
  if(cityCountry.length===2) loadByCity(cityCountry[0], cityCountry[1]);
});

// ==== Default city ====
window.addEventListener("load", () => {
  loadByCity("Kolkata", "IN");
});
