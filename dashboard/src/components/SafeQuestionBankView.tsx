import { useState, useEffect } from "react";
import { api } from "../api";
import type { SafeQuestion } from "../api";
import { ShieldCheck, Search, Lock } from "lucide-react";

export const SafeQuestionBankView = () => {

  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("all");

  useEffect(() => {
    api.getQuestions().then(setQuestions).catch(console.error);
  }, []);

  const topics = ["all", ...Array.from(new Set(questions.map((q) => q.topic)))];

  const filtered = questions.filter((q) => {
    const matchesTopic = selectedTopic === "all" || q.topic === selectedTopic;
    const matchesSearch =
      q.text.toLowerCase().includes(search.toLowerCase()) ||
      q.question_id.toLowerCase().includes(search.toLowerCase()) ||
      q.topic.toLowerCase().includes(search.toLowerCase());
    return matchesTopic && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-slate-100">Clinically Reviewed Safe Question Bank</h3>
            <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3" /> ACTION SPACE LOCKED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            The PPO reinforcement learning agent selects questions exclusively from this validated catalog. No unrestricted generative LLM questions permitted.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search questions or topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 capitalize"
          >
            {topics.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All Constructs" : t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((q) => (
          <div key={q.question_id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-indigo-400">{q.question_id}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    q.difficulty === 1 ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800" :
                    q.difficulty === 2 ? "bg-amber-950/60 text-amber-300 border border-amber-800" :
                    "bg-rose-950/60 text-rose-300 border border-rose-800"
                  }`}>
                    Tier {q.difficulty}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 capitalize">
                    {q.topic.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-200 font-medium leading-relaxed">
                "{q.text}"
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-[10px] font-semibold text-slate-500 uppercase block">Follow-up Purpose:</span>
              <p className="text-[11px] text-slate-400 mt-0.5 italic">
                {q.follow_up_purpose || "Assessment inquiry."}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
