/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";

import type { Job, User } from "./types";
import Navbar from "./designs/modern/Navbar";
import LoginModal from "./components/LoginModal";
import ApplicationModal from "./components/ApplicationModal";
import EditProfileModal from "./components/EditProfileModal";
import ProfilePreviewModal, {
  type ProfilePreview,
} from "./components/ProfilePreviewModal";
import MyApplicationsModal from "./components/MyApplicationsModal";
import InfoModals from "./components/InfoModals";
import NotificationsModal from "./components/NotificationsModal";
import AuthActionPage from "./components/AuthActionPage";
import StudentView from "./designs/modern/StudentView";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import RecruiterProfilePage from "./pages/RecruiterProfilePage";
import { ensureCsrf, fetchCurrentUser, fetchStudentProfile, fetchUnreadCount, logout, registerAccount, updateStudentProfile } from "./services/api";

export default function App() {
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/jobs",
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const currentUserEmail = currentUser?.email || "";
  const currentUserName = currentUser?.profile?.name || currentUserEmail.split("@")[0] || "";
  const isLoggedIn = Boolean(currentUser);
  const [userRole, setUserRole] = useState<"student" | "recruiter">("student");
  const [companyName, setCompanyName] = useState("");
  const [university, setUniversity] = useState("");

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState<"login" | "register">(
    "login",
  );
  const [activeApplicationJob, setActiveApplicationJob] = useState<Job | null>(
    null,
  );
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [postJobRequested, setPostJobRequested] = useState(false);
  const [isProfilePreviewOpen, setIsProfilePreviewOpen] = useState(false);
  const [profilePreview, setProfilePreview] = useState<ProfilePreview>({
    photoUrl: "",
    name: "",
    university: "",
    graduationYear: "",
    bio: "",
    skills: [],
    experience: "",
    resumeUrl: "",
  });
  const [isApplicationsModalOpen, setIsApplicationsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [applicationRevision, setApplicationRevision] = useState(0);
  const [infoModalType, setInfoModalType] = useState<"about" | "contact">(
    "about",
  );

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    ensureCsrf();
    fetchCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        if (user.role === "student" || user.role === "recruiter") setUserRole(user.role);
        if (user.role === "student") {
          fetchStudentProfile().then((profile) => setProfilePhotoUrl(profile.photo_url || "")).catch(() => undefined);
        }
      })
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (currentPath === "/login" || currentPath === "/register") {
      setLoginModalMode(currentPath.slice(1) as "login" | "register");
      setIsLoginModalOpen(true);
      setIsInfoModalOpen(false);
      setIsProfileModalOpen(false);
      setIsProfilePreviewOpen(false);
      setIsApplicationsModalOpen(false);
    } else if (currentPath === "/about" || currentPath === "/contact") {
      setInfoModalType(currentPath.slice(1) as "about" | "contact");
      setIsInfoModalOpen(true);
      setIsLoginModalOpen(false);
      setIsProfileModalOpen(false);
      setIsProfilePreviewOpen(false);
      setIsApplicationsModalOpen(false);
    } else {
      setIsLoginModalOpen(false);
      setIsInfoModalOpen(false);
    }
  }, [currentPath]);

  useEffect(() => {
    setUnreadCount(0);
    setIsNotificationsOpen(false);
    if (!currentUser) return;
    const controller = new AbortController();
    fetchUnreadCount(controller.signal).then(result => {
      if (!controller.signal.aborted) setUnreadCount(result.count);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [currentUser?.id]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === "student" || user.role === "recruiter") setUserRole(user.role);
    if (user.role === "student") {
      fetchStudentProfile().then((profile) => setProfilePhotoUrl(profile.photo_url || "")).catch(() => undefined);
    } else {
      setProfilePhotoUrl("");
    }
  };

  const handleOpenLogin = (mode: "login" | "register" = "register") => {
    setLoginModalMode(mode);
    navigate(`/${mode}`);
  };

  const handleOpenInfo = (type: "about" | "contact") => {
    setInfoModalType(type);
    navigate(`/${type}`);
  };

  const handleOpenApplication = (job: Job) => {
    setActiveApplicationJob(job);
  };

  const handleOpenProfile = async () => {
    if (currentUser?.role === "recruiter") {
      navigate("/recruiter/profile");
      window.scrollTo({ top: 0 });
      return;
    }
    setIsProfilePreviewOpen(true);
    setIsApplicationsModalOpen(false);
    setIsInfoModalOpen(false);
    try {
      const profile = await fetchStudentProfile();
      setProfilePreview({
        photoUrl: profile.photo_url || "",
        name: profile.name || currentUserName,
        university: profile.university || "",
        graduationYear: profile.graduation_year ? String(profile.graduation_year) : "",
        bio: profile.bio || "",
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        experience: profile.experience || "",
        resumeUrl: profile.has_resume ? "Saved private PDF" : "",
      });
    } catch {}
  };

  const handleEditProfile = () => {
    setIsProfilePreviewOpen(false);
    setIsProfileModalOpen(true);
  };

  const handleOpenApplications = () => {
    setIsApplicationsModalOpen(true);
    setIsProfileModalOpen(false);
    setIsInfoModalOpen(false);
  };

  const registerUser = async (payload: any) => {
    try {
      return await registerAccount(payload);
    } catch (err: any) {
      throw err;
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setCurrentUser(null);
    setProfilePhotoUrl("");
    setUnreadCount(0);
    setUserRole("student");
    setIsProfilePreviewOpen(false);
    setPostJobRequested(false);
  };

  return (
    <div className="modern-app min-h-screen flex flex-col bg-brand-bg font-sans selection:bg-[#016a61]/10 selection:text-[#016a61]">
      <Navbar
        isLoggedIn={isLoggedIn}
        currentUserName={currentUserName}
        profilePhotoUrl={currentUser?.role === "recruiter" ? currentUser.profile?.photo_url || "" : profilePhotoUrl}
        userRole={userRole}
        canManageJobs={Boolean(currentUser?.capabilities.manage_jobs)}
        onLoginClick={() => handleOpenLogin("login")}
        onRegisterClick={() => handleOpenLogin("register")}
        currentPath={currentPath}
        onLogout={handleLogout}
        onBrowseJobs={() => {
          navigate("/jobs");
          if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        onPostJob={() => {
          setPostJobRequested(true);
          navigate("/jobs");
        }}
        onMyProfile={handleOpenProfile}
        onMyApplications={handleOpenApplications}
        onAboutClick={() => handleOpenInfo("about")}
        onContactClick={() => handleOpenInfo("contact")}
        onNotifications={() => setIsNotificationsOpen(true)}
        unreadCount={unreadCount}
      />

      {currentPath === "/verify-email" || currentPath.startsWith("/verify-email/") || currentPath.startsWith("/password/reset/confirm/") ? (
        <AuthActionPage key={currentPath} path={currentPath} onDone={() => navigate("/login")} />
      ) : isLoggedIn && userRole === "recruiter" ? (
        currentPath.replace(/\/$/, "") === "/recruiter/profile" ? (
          <RecruiterProfilePage
            key={currentUser.id}
            onBack={() => navigate("/jobs")}
            onProfileSaved={profile => setCurrentUser(user => user ? { ...user, profile: { ...user.profile, name: profile.name, photo_url: profile.photo_url, approval_status: profile.approval_status, rejection_reason: profile.rejection_reason } } : user)}
            onCompanySaved={company => setCurrentUser(user => {
              if (!user) return user;
              const approved = user.email_verified && user.profile?.approval_status === "approved" && company.approval_status === "approved";
              return { ...user, profile: { ...user.profile, name: user.profile?.name || "", company_approval_status: company.approval_status, company_rejection_reason: company.rejection_reason }, capabilities: { ...user.capabilities, manage_jobs: approved, browse_students: approved } };
            })}
          />
        ) : <RecruiterDashboard key={currentUser.id} onEditProfile={handleOpenProfile} onUserChange={setCurrentUser} postJobRequested={postJobRequested} onPostJobHandled={() => setPostJobRequested(false)} />
      ) : (
        <StudentView
          isLoggedIn={isLoggedIn}
          onOpenLogin={handleOpenLogin}
          onOpenApplication={handleOpenApplication}
          applicationRevision={applicationRevision}
        />
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        initialMode={loginModalMode}
        onClose={() => navigate("/jobs")}
        onLoginSuccess={handleLoginSuccess}
        userRole={userRole}
        setUserRole={setUserRole}
        companyName={companyName}
        setCompanyName={setCompanyName}
        university={university}
        setUniversity={setUniversity}
        onRegister={registerUser}
      />

      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userEmail={currentUserEmail}
        onAuthRequired={() => {
          handleLogout();
          handleOpenLogin("login");
        }}
        onSave={async (payload) => {
          const profile = await updateStudentProfile(payload);
          setProfilePhotoUrl(profile.photo_url || "");
        }}
      />

      <ProfilePreviewModal
        isOpen={isProfilePreviewOpen}
        onClose={() => setIsProfilePreviewOpen(false)}
        onEdit={handleEditProfile}
        profile={profilePreview}
      />

      <MyApplicationsModal
        isOpen={isApplicationsModalOpen}
        onClose={() => setIsApplicationsModalOpen(false)}
      />

      <ApplicationModal
        key={activeApplicationJob?.id || "closed"}
        isOpen={activeApplicationJob !== null}
        job={activeApplicationJob}
        userEmail={currentUserEmail}
        userName={currentUserName}
        onClose={() => setActiveApplicationJob(null)}
        onApplySuccess={(jobId) => {
          setActiveApplicationJob(null);
          setApplicationRevision((revision) => revision + 1);
          return jobId;
        }}
      />

      <InfoModals
        isOpen={isInfoModalOpen}
        type={infoModalType}
        onClose={() => navigate("/jobs")}
      />
      <NotificationsModal key={currentUser?.id || "signed-out"} isOpen={Boolean(currentUser) && isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onRead={() => setUnreadCount(0)} />
    </div>
  );
}
