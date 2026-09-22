import { useEffect, useState } from "react";
import { apiRequest } from "../api";

function Topbar() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    apiRequest("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const displayName = user?.username || "User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="topbar">
      <label className="search-box" htmlFor="global-search">
        <span>Search</span>
        <input id="global-search" type="search" placeholder="Search anything..." />
      </label>
      <div className="topbar-actions">
        <button className="icon-button" type="button" aria-label="Notifications">
          !
        </button>
        <div className="user-chip">
          {user?.profile_picture_url ? (
            <img className="avatar image-avatar" src={user.profile_picture_url} alt="" />
          ) : (
            <span className="avatar">{initials}</span>
          )}
          <span>{displayName}</span>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
