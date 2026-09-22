import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState(
    token ? "Confirming your email..." : "This confirmation link is missing a token.",
  );
  const [isError, setIsError] = useState(!token);

  useEffect(() => {
    if (!token) return;

    let isActive = true;

    apiRequest(`/users/verify-email?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (!isActive) return;
        setStatus(data?.message || "Email confirmed successfully.");
      })
      .catch((error) => {
        if (!isActive) return;
        setIsError(true);
        setStatus(error.message);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="leaf-mark">P</span>
          <h1>PesaSense-AI</h1>
          <p>Smarter Money. Brighter Future.</p>
        </div>
        <div className="section-heading centered">
          <h2>{isError ? "Confirmation Failed" : "Email Confirmation"}</h2>
          <p>{status}</p>
        </div>
        <Link className="auth-button-link" to="/">Back to login</Link>
      </section>
    </div>
  );
}

export default VerifyEmail;
