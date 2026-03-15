import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./home";
import Generic from "./generic";
import Time from "./Graphs/time";
import Customized from "./customized";
import { AppStateProvider } from "./AppStateContext";

function App() {

  return (
    <AppStateProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/generic" element={<Generic />} />
          <Route path="/Time" element={<Time />} />
          <Route path="/customized" element={<Customized/>}/>

        </Routes>
      </Router>
    </AppStateProvider>
  );
}

export default App;