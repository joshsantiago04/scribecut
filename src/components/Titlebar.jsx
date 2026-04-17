import logo from "../assets/peaklogo.webp";
import { getCurrentWindow } from "@tauri-apps/api/window";

const fadeRoot = (opacity, duration = 120) => {
    document.getElementById("root").style.opacity = opacity;
    return new Promise((r) => setTimeout(r, duration));
};

export default function Titlebar() {
    const handleMinimize = async () => {
        await fadeRoot("0");
        await getCurrentWindow().minimize();
        fadeRoot("1", 0);
    };

    const handleMaximize = async () => {
        document.getElementById("root").style.opacity = "0";
        await new Promise((r) => setTimeout(r, 160)); // wait for full CSS transition
        await getCurrentWindow().toggleMaximize();
        await new Promise((r) => setTimeout(r, 50)); // let WM settle
        document.getElementById("root").style.opacity = "1";
    };

    return (
        <div className="titlebar" data-tauri-drag-region>
            <div className="titlebar-left">
                <img src={logo} alt="ScribeCut" className="titlebar-logo" />
                <span className="titlebar-title">ScribeCut</span>
            </div>
            <div className="titlebar-controls">
                <button className="titlebar-btn" onClick={handleMinimize}>
                    &#8212;
                </button>
                <button className="titlebar-btn" onClick={handleMaximize}>
                    &#9633;
                </button>
                <button
                    className="titlebar-btn close"
                    onClick={() => getCurrentWindow().close()}
                >
                    &#10005;
                </button>
            </div>
        </div>
    );
}
