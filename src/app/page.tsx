"use client";
import dynamic from "next/dynamic";

const Artifact = dynamic(() => import("@/components/artifact"), { ssr: false });

const Home = () => {
  return (
    <main className="min-h-screen antialiased">
      <Artifact />
    </main>
  );
};

export default Home;
