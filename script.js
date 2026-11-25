const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const locationButton = document.querySelector("#location-button");
const message = document.querySelector("#message");
const weatherContent = document.querySelector("#weather-content");

const weatherDescriptions = {
  0:["Clear sky","☀"],1:["Mainly clear","🌤"],2:["Partly cloudy","⛅"],3:["Overcast","☁"],
  45:["Fog","🌫"],48:["Rime fog","🌫"],51:["Light drizzle","🌦"],53:["Drizzle","🌦"],55:["Dense drizzle","🌧"],
  56:["Freezing drizzle","🌧"],57:["Heavy freezing drizzle","🌧"],61:["Light rain","🌦"],63:["Rain","🌧"],65:["Heavy rain","🌧"],
  66:["Freezing rain","🌧"],67:["Heavy freezing rain","🌧"],71:["Light snow","🌨"],73:["Snow","❄"],75:["Heavy snow","❄"],
  77:["Snow grains","❄"],80:["Rain showers","🌦"],81:["Rain showers","🌧"],82:["Heavy rain showers","⛈"],
  85:["Snow showers","🌨"],86:["Heavy snow showers","❄"],95:["Thunderstorm","⛈"],96:["Thunderstorm with hail","⛈"],99:["Thunderstorm with hail","⛈"]
};

function describeWeather(code) {
  return weatherDescriptions[code] || ["Weather conditions unavailable","🌡"];
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#ffb5b5" : "";
}

function formatDay(dateString, index) {
  if (index === 0) return "Today";
  return new Date(dateString + "T12:00:00").toLocaleDateString(undefined, {weekday:"short"});
}

async function getCoordinates(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({name:city,count:"1",language:"en",format:"json"});
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not search for that city. Please try again.");
  const data = await response.json();
  if (!data.results || !data.results.length) throw new Error("City not found. Check the spelling and try again.");
  return data.results[0];
}

async function getWeather(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude,longitude,
    current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone:"auto",forecast_days:"5"
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable. Please try again.");
  return response.json();
}

function renderWeather(place, data) {
  const current = data.current;
  const [description, icon] = describeWeather(current.weather_code);
  document.querySelector("#place-name").textContent = place.name;
  document.querySelector("#place-country").textContent = [place.admin1,place.country].filter(Boolean).join(", ");
  document.querySelector("#today-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
  document.querySelector("#temperature").textContent = Math.round(current.temperature_2m);
  document.querySelector("#condition").textContent = description;
  document.querySelector("#weather-icon").textContent = current.is_day ? icon : (current.weather_code === 0 ? "🌙" : icon);
  document.querySelector("#feels-like").textContent = Math.round(current.apparent_temperature) + "°C";
  document.querySelector("#humidity").textContent = current.relative_humidity_2m + "%";
  document.querySelector("#wind-speed").textContent = Math.round(current.wind_speed_10m) + " km/h";

  const forecast = document.querySelector("#forecast-grid");
  forecast.replaceChildren();
  data.daily.time.forEach((date,index) => {
    const [dayDescription,dayIcon] = describeWeather(data.daily.weather_code[index]);
    const card = document.createElement("article");
    card.className = "forecast-card";
    const day = document.createElement("div"); day.className="day"; day.textContent=formatDay(date,index);
    const weatherIcon = document.createElement("div"); weatherIcon.className="icon"; weatherIcon.textContent=dayIcon;
    const range = document.createElement("div"); range.className="range";
    range.textContent = Math.round(data.daily.temperature_2m_max[index]) + "° ";
    const low = document.createElement("span"); low.textContent = Math.round(data.daily.temperature_2m_min[index]) + "°";
    range.append(low);
    const rain = document.createElement("div"); rain.className="rain"; rain.textContent=(data.daily.precipitation_probability_max[index] ?? 0) + "% rain";
    card.append(day,weatherIcon,range,rain);
    card.title = dayDescription;
    forecast.append(card);
  });
  weatherContent.hidden = false;
}

async function showWeatherForPlace(place) {
  searchButton.disabled = true;
  searchButton.textContent = "Loading…";
  weatherContent.hidden = true;
  setMessage("Fetching the latest weather…");
  try {
    const weather = await getWeather(place.latitude,place.longitude);
    renderWeather(place,weather);
    setMessage("Weather updated successfully.");
  } catch (error) {
    setMessage(error.message || "Something went wrong. Please try again.",true);
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Search <span>↗</span>';
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  searchButton.disabled = true;
  setMessage("Finding your city…");
  try {
    const place = await getCoordinates(city);
    await showWeatherForPlace(place);
  } catch (error) {
    setMessage(error.message || "Unable to find that city.",true);
    searchButton.disabled = false;
    searchButton.innerHTML = 'Search <span>↗</span>';
  }
});

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setMessage("Your browser does not support location access.",true);
    return;
  }
  setMessage("Requesting your location…");
  navigator.geolocation.getCurrentPosition(async (position) => {
    const {latitude,longitude} = position.coords;
    const place = {name:"Your location",admin1:"",country:""};
    await showWeatherForPlace({...place,latitude,longitude});
  }, () => setMessage("Location access was denied or unavailable. You can search for a city instead.",true), {enableHighAccuracy:false,timeout:10000});
});

cityInput.value = "Kochi";
