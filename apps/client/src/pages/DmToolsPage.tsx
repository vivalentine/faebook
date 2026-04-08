import { Link } from "react-router-dom";
import ShellPlaceholderPage from "./ShellPlaceholderPage";

export default function DmToolsPage() {
  return (
    <>
      <ShellPlaceholderPage
        title="DM Tools"
        description="DM import and admin controls are intentionally placeholder-only in this milestone."
      />
      <div className="placeholder-inline-link">
        <Link to="/archive">Open Archive</Link>
      </div>
    </>
  );
}
