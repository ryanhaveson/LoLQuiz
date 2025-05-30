'use client';

// Import authentication and routing utilities
import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { determineChampionDamageType } from '../utils/championUtils';

// Helper to shuffle an array
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Quiz component
function QuizChampionIcon({ onExit }: { onExit: () => void }) {
  const [champions, setChampions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<any | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [log, setLog] = useState<any[]>([]);

  // Fetch champion data on mount
  useEffect(() => {
    console.log('Fetching champion data...');
    fetch('/patch-data/15.11.1/data/en_US/championFull.json')
      .then(res => res.json())
      .then(data => {
        console.log('Champion data response:', {
          hasData: !!data,
          hasDataData: !!data?.data,
          dataDataKeys: data?.data ? Object.keys(data.data) : []
        });

        if (!data?.data) {
          console.error('Invalid data structure received:', data);
          setLoading(false);
          return;
        }

        // The data structure is now { data: { [championId]: championData } }
        const champList = Object.values(data.data);
        console.log('Processed champion list:', {
          length: champList.length,
          firstChampion: typeof champList[0] === 'object' && champList[0] !== null ? {
            name: (champList[0] as any).name,
            hasPassive: !!(champList[0] as any).passive,
            hasSpells: !!(champList[0] as any).spells,
            spellsLength: (champList[0] as any).spells?.length
          } : 'unknown'
        });

        setChampions(champList);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching champion data:', error);
        setLoading(false);
      });
  }, []);

  // Pick a new question
  const newQuestion = () => {
    if (champions.length < 5) return;
    const correct = champions[Math.floor(Math.random() * champions.length)];
    const others = shuffle(champions.filter(c => c.id !== correct.id)).slice(0, 4);
    const optionNames = shuffle([correct.name, ...others.map(c => c.name)]);
    setQuestion(correct);
    setOptions(optionNames);
    setSelected(null);
    setFeedback(null);
  };

  // Start first question only once after loading
  useEffect(() => {
    if (!loading && champions.length > 0 && !question) newQuestion();
    // eslint-disable-next-line
  }, [loading]);

  // Handle answer selection
  const handleSelect = (name: string) => {
    setSelected(name);
    const correct = name === question.name;
    setFeedback(correct ? 'Correct!' : 'Incorrect, try again.');
    // Log the attempt
    const entry = {
      champion: question.name,
      championId: question.id,
      icon: question.image.full,
      options,
      selected: name,
      correct,
      timestamp: Date.now(),
    };
    setLog(prev => {
      const updated = [...prev, entry];
      localStorage.setItem('quiz_log', JSON.stringify(updated));
      return updated;
    });
  };

  // Next question
  const handleNext = () => {
    newQuestion();
  };

  // Exit quiz
  const handleExit = () => {
    onExit();
  };

  if (loading || !question) return <div className="p-8 bg-white rounded shadow text-center">Loading quiz...</div>;

  // Use the patch version from state for the icon URL
  const iconUrl = question?.image?.full
    ? `/patch-data/15.11.1/img/champion/${question.image.full}`
    : null;

  return (
    <div className="p-8 bg-white rounded shadow text-center">
      <h2 className="text-xl font-bold mb-4">Which champion is this?</h2>
      {iconUrl && <img src={iconUrl} alt="champion icon" className="mx-auto mb-6 w-24 h-24 object-contain" />}
      <div className="flex flex-col gap-3 mb-4">
        {options.map((name) => (
          <button
            key={name}
            onClick={() => handleSelect(name)}
            className={`py-2 px-4 rounded border ${selected === name ? (name === question.name ? 'bg-green-200 border-green-500' : 'bg-red-200 border-red-500') : 'bg-gray-100 border-gray-300'} font-semibold`}
            disabled={!!feedback && name === question.name}
          >
            {name}
          </button>
        ))}
      </div>
      {feedback && <div className={`mb-4 text-lg font-bold ${feedback === 'Correct!' ? 'text-green-600' : 'text-red-600'}`}>{feedback}</div>}
      {/* Champion details after correct answer */}
      {feedback === 'Correct!' && question && (() => {
        // Debug logging for missing data
        if (
          !question.passive ||
          !question.passive.image ||
          !question.passive.image.full ||
          !question.spells ||
          question.spells.length !== 4 ||
          question.spells.some((spell: any) => !spell.image || !spell.image.full)
        ) {
          console.error('Patch data issue:', question);
        }
        return (
          <div className="mt-6 text-left">
            <div className="mb-2 text-xl font-bold">{question.name} <span className="text-base font-normal">- {question.title}</span></div>
            <div className="mb-2 italic text-gray-700">{question.lore}</div>
            <div className="mb-2 font-semibold">
              {question.stats.attackrange <= 325 ? 'Melee Champion' : 'Ranged Champion'} ({question.stats.attackrange} range)
            </div>
            <div className="mb-2 font-semibold">
              Primary Damage Type: {determineChampionDamageType(question)}
            </div>
            {/* Passive */}
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <img
                  src={`/patch-data/15.11.1/img/passive/${question.passive.image.full}`}
                  alt={question.passive.name}
                  className="w-8 h-8"
                />
                <span className="font-semibold">{question.passive.name} (Passive):</span>
              </div>
              <div className="ml-10 text-gray-700 text-sm">{question.passive.description}</div>
            </div>
            {/* Abilities Q/W/E/R */}
            {question.spells.map((spell: any, idx: number) => (
              <div className="mb-2" key={spell.id}>
                <div className="flex items-center gap-2">
                  <img
                    src={`/patch-data/15.11.1/img/spell/${spell.image.full}`}
                    alt={spell.name}
                    className="w-8 h-8"
                  />
                  <span className="font-semibold">{['Q','W','E','R'][idx]}: {spell.name}</span>
                </div>
                <div className="ml-10 text-gray-700 text-sm">{spell.description}</div>
              </div>
            ))}
          </div>
        );
      })()}
      <div className="flex gap-4 justify-center mt-6">
        <button
          onClick={handleNext}
          className="px-4 py-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          Next
        </button>
        <button
          onClick={handleExit}
          className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [showQuiz, setShowQuiz] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Check download progress
  useEffect(() => {
    const checkProgress = async () => {
      try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        setDownloadProgress(data.progress);
        setDownloadMessage(data.message);
        setIsDownloading(data.isDownloading);

        if (data.isDownloading) {
          // Check again in 1 second if still downloading
          setTimeout(checkProgress, 1000);
        }
      } catch (error) {
        console.error('Error checking progress:', error);
      }
    };

    checkProgress();
  }, []);

  // Show a loading message while authentication status is being determined
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8">
          <div className="text-lg text-gray-700 mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  // If the user is signed in, show a personalized welcome message and a sign-out button
  if (session) {
    // Use the user's name if available, otherwise fall back to their email or a default
    const username = session.user?.name || session.user?.email || 'Summoner';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        {/* Welcome message */}
        <h1 className="text-3xl font-bold text-center mb-8">Welcome {username}</h1>
        {/* Download status */}
        {isDownloading && (
          <div className="w-full max-w-md mb-8 p-4 bg-white rounded-lg shadow">
            <div className="text-lg text-gray-700 mb-2">{downloadMessage}</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              This may take a few minutes...
            </div>
          </div>
        )}
        {/* Quiz button */}
        {!showQuiz && (
          <button
            onClick={() => setShowQuiz(true)}
            className="w-full max-w-xs py-3 px-4 mb-4 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            Quiz me on champion icons
          </button>
        )}
        {/* Sign out button */}
        <button
          onClick={() => signOut()}
          className="w-full max-w-xs py-3 px-4 rounded bg-gray-200 text-gray-900 font-semibold hover:bg-gray-300 transition"
        >
          Sign Out
        </button>
        {/* Quiz component */}
        {showQuiz && (
          <div className="mt-8 w-full max-w-md">
            <QuizChampionIcon onExit={() => setShowQuiz(false)} />
          </div>
        )}
      </div>
    );
  }

  // If the user is not signed in, show the landing page with sign-in options
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      {/* App title */}
      <h1 className="text-3xl font-bold mb-10 text-center">LoL Quiz</h1>
      {/* Download status */}
      {isDownloading && (
        <div className="w-full max-w-md mb-8 p-4 bg-white rounded-lg shadow">
          <div className="text-lg text-gray-700 mb-2">{downloadMessage}</div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            This may take a few minutes...
          </div>
        </div>
      )}
      {/* Authentication buttons */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        {/* Sign in with Google button */}
        <button
          onClick={() => signIn('google')}
          className="w-full py-3 px-4 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          Sign in with Google
        </button>
        {/* Sign in with email button (navigates to /signin) */}
        <Link href="/signin" className="w-full">
          <button className="w-full py-3 px-4 rounded bg-gray-200 text-gray-900 font-semibold hover:bg-gray-300 transition">
            Sign in with Email
          </button>
        </Link>
        {/* Create account button (navigates to /register) */}
        <Link href="/register" className="w-full">
          <button className="w-full py-3 px-4 rounded bg-blue-100 text-blue-900 font-semibold hover:bg-blue-200 transition">
            Create Account
          </button>
        </Link>
      </div>
    </div>
  );
} 