import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Flame,
  Sun,
  Moon,
  Trophy,
  Award,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { patientService } from '../../services/patientService';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Mascot } from '../../components/mascot/Mascot';
import { MascotBubble } from '../../components/mascot/MascotBubble';
import { TRIVIA_QUIZ_QUESTIONS } from '../../components/mascot/messages';

export function BrushStreak() {
  const { user } = useAuth();
  const toast = useToast();
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [mascotMood, setMascotMood] = useState('brushing');

  // Mini-quiz game states
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizQuestionIdx, setQuizQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const loadStreak = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await patientService.getBrushStreak(user.id);
      setStreakData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStreak();
  }, [user?.id]);

  const today = new Date().toISOString().split('T')[0];
  const todayHistory = streakData?.history?.[today] || { morning: false, night: false };

  const handleCheckIn = async (period) => {
    if (todayHistory[period]) {
      toast.info(`You have already completed your ${period} brushing check-in!`);
      return;
    }

    setIsCheckingIn(true);
    setMascotMood('cheer');

    try {
      const updated = await patientService.recordBrushCheckIn(user.id, period);
      setStreakData(updated);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#f97316', '#0d9488', '#fbbf24'],
      });

      toast.success(`+25 Smile Points earned for ${period} brushing!`);

      if (updated.newBadges?.length > 0) {
        toast.success(`🏆 Unlocked: ${updated.newBadges.join(', ')}!`);
      }
    } catch (err) {
      toast.error('Failed to log check-in');
    } finally {
      setIsCheckingIn(false);
      setTimeout(() => setMascotMood('happy'), 4000);
    }
  };

  // Quiz Game Handlers
  const handleSelectQuizAnswer = (optionIdx) => {
    if (selectedAnswers[quizQuestionIdx] !== undefined) return; // Answered
    const isCorrect = optionIdx === TRIVIA_QUIZ_QUESTIONS[quizQuestionIdx].correctIndex;
    setSelectedAnswers({ ...selectedAnswers, [quizQuestionIdx]: optionIdx });

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const handleNextQuizQuestion = () => {
    if (quizQuestionIdx < TRIVIA_QUIZ_QUESTIONS.length - 1) {
      setQuizQuestionIdx((prev) => prev + 1);
    } else {
      setQuizFinished(true);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });
    }
  };

  const handleRestartQuiz = () => {
    setQuizStarted(false);
    setQuizQuestionIdx(0);
    setSelectedAnswers({});
    setQuizFinished(false);
    setQuizScore(0);
  };

  const badges = [
    {
      id: 'badge-3-days',
      title: '3-Day Sparkle',
      desc: 'Brush consistently for 3 straight days',
      req: 3,
      unlocked: streakData?.unlockedBadges?.includes('badge-3-days') || (streakData?.currentStreak >= 3),
      points: '+50 XP',
    },
    {
      id: 'badge-7-days',
      title: '7-Day Diamond',
      desc: 'Maintain a 1-week clean routine',
      req: 7,
      unlocked: streakData?.unlockedBadges?.includes('badge-7-days') || (streakData?.currentStreak >= 7),
      points: '+150 XP',
    },
    {
      id: 'badge-30-days',
      title: '30-Day Master',
      desc: '1 Month of perfect oral defense',
      req: 30,
      unlocked: streakData?.unlockedBadges?.includes('badge-30-days') || (streakData?.currentStreak >= 30),
      points: '+500 XP',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink-primary tracking-tight">
          Brush Streak & Smile Rewards
        </h2>
        <p className="text-sm text-ink-secondary">
          Log morning and night brushing routines to build streaks, unlock badges, and earn rewards.
        </p>
      </div>

      {/* Hero Streak Banner with Sparky Reaction */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white shadow-soft-lg flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
        <div className="flex-shrink-0">
          <Mascot mood={mascotMood} size="lg" />
        </div>

        <div className="flex-1 text-center md:text-left space-y-2 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-sm">
            <Flame className="w-4 h-4 text-amber-200" />
            <span>Active Dental Defense Habit</span>
          </div>

          <h3 className="text-3xl sm:text-4xl font-heading font-black">
            {streakData?.currentStreak || 0} Day Streak!
          </h3>

          <p className="text-sm text-orange-100 max-w-lg">
            Longest Record: <strong>{streakData?.longestStreak || 0} days</strong> | Total Balance:{' '}
            <strong>{streakData?.totalPoints || 0} Smile Points</strong>
          </p>
        </div>

        {/* Action Check-in buttons */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-3 z-10 w-full sm:w-auto">
          <Button
            variant={todayHistory.morning ? 'secondary' : 'primary'}
            size="md"
            disabled={todayHistory.morning || isCheckingIn}
            onClick={() => handleCheckIn('morning')}
            leftIcon={todayHistory.morning ? CheckCircle2 : Sun}
            className={todayHistory.morning ? 'bg-white/20 border-white/40 text-white hover:bg-white/30' : 'bg-white text-orange-700 hover:bg-orange-50 shadow-soft'}
          >
            {todayHistory.morning ? 'Morning Done ✓' : 'Log Morning Brush'}
          </Button>

          <Button
            variant={todayHistory.night ? 'secondary' : 'primary'}
            size="md"
            disabled={todayHistory.night || isCheckingIn}
            onClick={() => handleCheckIn('night')}
            leftIcon={todayHistory.night ? CheckCircle2 : Moon}
            className={todayHistory.night ? 'bg-white/20 border-white/40 text-white hover:bg-white/30' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-soft'}
          >
            {todayHistory.night ? 'Night Done ✓' : 'Log Night Brush'}
          </Button>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-heading font-bold text-ink-primary">
            Unlockable Achievement Badges
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {badges.map((b) => (
            <Card
              key={b.id}
              className={`p-5 space-y-3 transition-all ${
                b.unlocked
                  ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-soft-sm'
                  : 'opacity-60 bg-surface-50 dark:bg-surface-100/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-soft-sm ${
                    b.unlocked
                      ? 'bg-amber-500 text-white'
                      : 'bg-surface-200 text-ink-muted'
                  }`}
                >
                  <Award className="w-6 h-6" />
                </div>
                <Badge variant={b.unlocked ? 'accent' : 'secondary'} size="sm">
                  {b.unlocked ? 'Unlocked 🌟' : `Needs ${b.req} Days`}
                </Badge>
              </div>

              <div>
                <h4 className="font-heading font-bold text-ink-primary text-sm">
                  {b.title}
                </h4>
                <p className="text-xs text-ink-secondary mt-0.5">{b.desc}</p>
              </div>

              <div className="pt-2 border-t border-surface-border text-xs font-bold text-orange-600 dark:text-orange-400">
                Reward: {b.points}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tooth Trivia Mini-Quiz Game */}
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <div>
              <h3 className="text-lg font-heading font-bold text-ink-primary">
                Sparky&apos;s Dental IQ Mini-Quiz
              </h3>
              <p className="text-xs text-ink-secondary">
                Answer 3 fun questions to test your oral health knowledge!
              </p>
            </div>
          </div>
          <Badge variant="primary">3 Questions</Badge>
        </div>

        {!quizStarted && !quizFinished && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-600 mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <h4 className="text-base font-heading font-bold text-ink-primary">
              Ready to take the dental challenge?
            </h4>
            <p className="text-xs text-ink-secondary max-w-sm mx-auto">
              Brush up on enamel science, flossing facts, and proper hygiene habits.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setQuizStarted(true)}
              rightIcon={ArrowRight}
            >
              Start Mini-Quiz
            </Button>
          </div>
        )}

        {quizStarted && !quizFinished && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Question {quizQuestionIdx + 1} of {TRIVIA_QUIZ_QUESTIONS.length}</span>
              <span>Score: {quizScore}</span>
            </div>

            <div className="p-5 rounded-2xl bg-surface-50 dark:bg-surface-100/40 border border-surface-border space-y-4">
              <h4 className="text-base font-heading font-bold text-ink-primary">
                {TRIVIA_QUIZ_QUESTIONS[quizQuestionIdx].question}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TRIVIA_QUIZ_QUESTIONS[quizQuestionIdx].options.map((opt, idx) => {
                  const isAnswered = selectedAnswers[quizQuestionIdx] !== undefined;
                  const isSelected = selectedAnswers[quizQuestionIdx] === idx;
                  const isCorrect = idx === TRIVIA_QUIZ_QUESTIONS[quizQuestionIdx].correctIndex;

                  let btnStyle = 'bg-surface-card border-surface-border hover:border-teal-400 text-ink-primary';
                  if (isAnswered) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-100 dark:bg-emerald-950 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold';
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-rose-100 dark:bg-rose-950 border-rose-500 text-rose-800 dark:text-rose-200';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleSelectQuizAnswer(idx)}
                      className={`p-3.5 rounded-xl border text-left text-xs sm:text-sm font-semibold transition-all ${btnStyle}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {selectedAnswers[quizQuestionIdx] !== undefined && (
                <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 animate-fadeIn">
                  <strong>Explanation:</strong> {TRIVIA_QUIZ_QUESTIONS[quizQuestionIdx].explanation}
                </div>
              )}
            </div>

            {selectedAnswers[quizQuestionIdx] !== undefined && (
              <div className="flex justify-end">
                <Button variant="primary" size="md" onClick={handleNextQuizQuestion} rightIcon={ArrowRight}>
                  {quizQuestionIdx === TRIVIA_QUIZ_QUESTIONS.length - 1 ? 'Finish Quiz' : 'Next Question'}
                </Button>
              </div>
            )}
          </div>
        )}

        {quizFinished && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto text-2xl font-bold">
              🎉
            </div>
            <h4 className="text-xl font-heading font-extrabold text-ink-primary">
              Quiz Completed!
            </h4>
            <p className="text-sm text-ink-secondary">
              You scored <strong className="text-teal-600 dark:text-teal-400 text-base">{quizScore} out of {TRIVIA_QUIZ_QUESTIONS.length}</strong>! Sparky gives you two thumbs up!
            </p>
            <Button
              variant="outline"
              size="md"
              onClick={handleRestartQuiz}
              leftIcon={RotateCcw}
            >
              Play Again
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
