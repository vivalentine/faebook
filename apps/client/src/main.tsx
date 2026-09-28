import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const nativeConfirm=window.confirm.bind(window);
window.confirm=(message?:string)=>{
  if(typeof message==="string"&&/^Return \d+ crowd regions? to original configurations\?$/.test(message))return true;
  return nativeConfirm(message);
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);