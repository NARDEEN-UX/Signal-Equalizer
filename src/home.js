import { useNavigate } from "react-router-dom";
import "./CSS_files/home.css";
import { GiSoundWaves } from "react-icons/gi";
import { TbHeartRateMonitor } from "react-icons/tb";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      <div className="home-container">
        <div className="home-header">
          <h1 className="home-title">TOP Equalizer</h1>
          <p className="home-subtitle">Clean Sound. Better Mix.</p>
        </div>

        <div className="cards-container">
          <div className="signal-card medical-card" onClick={() => navigate("/generic")}>
            <div className="card-icon">
              <TbHeartRateMonitor size={60} />
            </div>
            <h2 className="card-title">Generic Mode</h2>

          </div>

          <div className="signal-card sound-card" onClick={() => navigate("/customized")}>
            <div className="card-icon">
              <GiSoundWaves size={60} />
            </div>
            <h2 className="card-title">Customized Modes</h2>

            <div className="card-features">
              <span className="feature-tag">Music</span>
              <span className="feature-tag">Animal</span>
              <span className="feature-tag">Human</span>
            </div>
          </div>
        </div>

        <footer className="home-footer">
          <p>Choose a mode type to get started</p>
        </footer>
      </div>
    </div>
  );
}

export default Home;