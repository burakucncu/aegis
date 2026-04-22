# 🛡️ Aegis: Network-Centric Air Defense Simulator

Aegis is a highly interactive, web-based 3D simulation of a modern, multi-battery national air defense network. Built entirely on top of **CesiumJS** and **Vite**, it visualizes ballistic trajectories, early warning radar detection, and automated intercept logic in a realistic 3D global environment.

![Aegis Simulation](https://img.shields.io/badge/Status-Active-success)
![CesiumJS](https://img.shields.io/badge/CesiumJS-3D_Mapping-1e88e5)
![Vite](https://img.shields.io/badge/Vite-Bundler-646cff)

## ✨ Key Features

* **National Airspace Radar:** A centralized early-warning dome (850km radius) covering the entire national border. Threats are tracked the moment they breach this airspace.
* **Proximity-Based Interception:** The system automatically calculates the nearest available Aegis battery to the threat and assigns it the intercept mission.
* **Dynamic Battery Deployment (C2 Interface):** Users can dynamically deploy new defense batteries or decommission existing ones in real-time through the Tactical UI.
* **Trajectory Prediction:** Calculates and draws the projected flight path of incoming threats based on parabolic equations.
* **Mid-Air Collision Physics:** Visualizes the launch of the interceptor missile, the exact point of interception, and dynamic mid-air explosion effects.
* **High-Fidelity 3D Environment:** Uses ArcGIS World Imagery and Cesium's 3D terrain for an immersive tactical map.

## 🛠️ Technology Stack

* **Frontend:** HTML5, Vanilla JavaScript, CSS3
* **3D Globe Engine:** CesiumJS (v1.116)
* **Build Tool & Dev Server:** Vite
* **Mapping Data:** ArcGIS MapServer

## 🚀 Installation & Setup

To run the Aegis Simulator locally, follow these steps:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine. You will also need a free [Cesium Ion Account](https://cesium.com/ion/) to retrieve an access token.

### 2. Clone the Repository
```bash
git clone [https://github.com/burakucncu/aegis.git](https://github.com/burakucncu/aegis.git)
cd aegis
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory and add your Cesium Ion Access Token to prevent exposing your API key:
```env
VITE_CESIUM_TOKEN=your_cesium_ion_access_token_here
```

### 5. Start the Development Server
```bash
npm run dev
```
Open the provided `localhost` link (usually `http://localhost:5173`) in your browser.

## 🎯 How to Use the Simulator

1. **Deploy Batteries:** Open the collapsible UI panel on the right side. Under "Radar & Battery", input a name and coordinates to deploy a new defense system, or use the default network.
2. **Set the Scenario:** Enter the Target Coordinates (where the threat is aiming) and the Launch Coordinates (where the threat is originating).
3. **Engage:** Click the **"Start Attack"** button.
4. **Observe:** Watch the telemetry data update in real-time as the threat breaches the national airspace, the nearest battery fires, and the interception occurs mid-air.

## 📁 Project Structure

```text
aegis/
├── src/
│   ├── app.js         # Core simulation logic, physics, and UI event listeners
│   └── style.css      # Custom styling for the tactical dashboard
├── index.html         # Main entry point and UI layout
├── package.json       # Dependencies and Vite scripts
├── .env               # (Not tracked) Your Cesium Token
└── README.md          # Project documentation
```

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).