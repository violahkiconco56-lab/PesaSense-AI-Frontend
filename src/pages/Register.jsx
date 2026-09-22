import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api";

const initialValues = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  profile_picture_url: "",
};

function Register() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function validate() {
    const nextErrors = {};
    if (values.username.trim().length < 3) {
      nextErrors.username = "Full name must be at least 3 characters.";
    }
    if (!values.email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (values.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (!values.confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (values.profile_picture_url && !/^https?:\/\/.+/i.test(values.profile_picture_url)) {
      nextErrors.profile_picture_url = "Use a valid image URL starting with http or https.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setMessage("");
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setIsSuccess(false);
    setMessage("");

    try {
      const data = await apiRequest("/users/", {
        method: "POST",
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          profile_picture_url: values.profile_picture_url || null,
        }),
      });

      setValues(initialValues);
      setIsSuccess(true);
      setMessage(data.email_verification_message || "Account created successfully.");
    } catch (error) {
      const detail = String(error.message || "");

      if (/username/i.test(detail)) {
        setErrors({ username: detail });
      } else if (/email/i.test(detail)) {
        setErrors({ email: detail });
      } else if (error.status === 0) {
        setMessage("Could not reach the server. Make sure the backend is running.");
        return;
      }

      setMessage(detail);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page register-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="leaf-mark">P</span>
          <h1>PesaSense-AI</h1>
          <p>Smarter Money. Brighter Future.</p>
        </div>
        <div className="section-heading centered">
          <h2>Create Your Account</h2>
          <p>Start your journey to better financial health</p>
        </div>

        <form className="stack-form" onSubmit={handleRegister} noValidate>
          <div className="field-group">
            <label htmlFor="username">Full name</label>
            <input
              className={errors.username ? "input-error" : ""}
              id="username"
              value={values.username}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder="Your full name"
              aria-invalid={Boolean(errors.username)}
              required
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="email">Email address</label>
            <input
              className={errors.email ? "input-error" : ""}
              id="email"
              type="email"
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="profile_picture_url">Profile picture URL</label>
            <input
              className={errors.profile_picture_url ? "input-error" : ""}
              id="profile_picture_url"
              value={values.profile_picture_url}
              onChange={(event) => updateField("profile_picture_url", event.target.value)}
              placeholder="https://example.com/photo.jpg"
              aria-invalid={Boolean(errors.profile_picture_url)}
            />
            {errors.profile_picture_url && (
              <span className="field-error">{errors.profile_picture_url}</span>
            )}
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <input
              className={errors.password ? "input-error" : ""}
              id="password"
              type="password"
              value={values.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="Create a password"
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              className={errors.confirmPassword ? "input-error" : ""}
              id="confirmPassword"
              type="password"
              value={values.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
              placeholder="Confirm your password"
              aria-invalid={Boolean(errors.confirmPassword)}
              required
            />
            {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Register"}
          </button>
        </form>

        {message && <p className={`form-message ${isSuccess ? "" : "error"}`}>{message}</p>}
        {isSuccess && (
          <p className="auth-switch">
            Account ready. <Link to="/">Log in</Link>
          </p>
        )}
        {!isSuccess && (
          <p className="auth-switch">
            Already have an account? <Link to="/">Log in</Link>
          </p>
        )}
      </section>
    </div>
  );
}

export default Register;
