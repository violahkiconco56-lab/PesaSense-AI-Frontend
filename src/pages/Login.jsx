import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, setToken } from "../api";

function Login() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  function validate() {
    const nextErrors = {};
    if (!values.email.trim()) {
      nextErrors.email = "Email or username is required.";
    }

    if (!values.password) {
      nextErrors.password = "Password is required.";
    } else if (values.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setMessage("");
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setMessage("");

    const formData = new URLSearchParams();
    formData.append("username", values.email);
    formData.append("password", values.password);
    formData.append("remember_me", String(rememberMe));

    try {
      const data = await apiRequest("/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      setToken(data.access_token, rememberMe);
      navigate("/dashboard");
    } catch (error) {
      // 401 = the credentials themselves are wrong, so point at both fields.
      // Anything else (server down, 500, network) is not the user's fault and
      // must not falsely accuse their email or password.
      if (error.status === 401) {
        setErrors({
          email: "Check your email or username.",
          password: "Check your password.",
        });
        setMessage(error.message || "Invalid email or password.");
      } else {
        setMessage(error.message || "Could not connect to the server.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="leaf-mark">P</span>
          <h1>PesaSense-AI</h1>
          <p>Smarter Money. Brighter Future.</p>
        </div>
        <div className="section-heading centered">
          <h2>Welcome Back</h2>
          <p>Log in to your account to continue</p>
        </div>

        <form className="stack-form" onSubmit={handleLogin} noValidate>
          <div className="field-group">
            <label htmlFor="email">Email or username</label>
            <input
              className={errors.email ? "input-error" : ""}
              type="text"
              id="email"
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              autoComplete="username"
              placeholder="Email or username"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <input
              className={errors.password ? "input-error" : ""}
              type="password"
              id="password"
              value={values.password}
              onChange={(event) => updateField("password", event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="form-options">
            <label className="check-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Remember me
            </label>
            <a href="#forgot">Forgot password?</a>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {message && <p className="form-message error">{message}</p>}
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </section>
    </div>
  );
}

export default Login;
