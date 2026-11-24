import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  const invalidInput = () => Object.assign(new Error('Invalid activity input'), { status: 400 });
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw invalidInput();

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  if (
    typeof userId !== 'string' ||
    !mongoose.isValidObjectId(userId) ||
    typeof teamId !== 'string' ||
    !mongoose.isValidObjectId(teamId) ||
    typeof type !== 'string' ||
    !type.trim() ||
    typeof minutes !== 'number' ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    throw invalidInput();
  }

  const [user, team] = await Promise.all([
    User.exists({ _id: userId, team: teamId }),
    Team.exists({ _id: teamId }),
  ]);
  if (!user || !team) throw invalidInput();

  return Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  const invalidInput = () => Object.assign(new Error('Invalid team input'), { status: 400 });
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw invalidInput();

  const { name, mascot, members = [] } = input as Record<string, unknown>;
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof mascot !== 'string' ||
    !mascot.trim() ||
    !Array.isArray(members) ||
    !members.every((member) => typeof member === 'string' && mongoose.isValidObjectId(member))
  ) {
    throw invalidInput();
  }

  const uniqueMemberIds = [...new Set(members as string[])];
  const existingMembers = await User.countDocuments({ _id: { $in: uniqueMemberIds } });
  if (existingMembers !== uniqueMemberIds.length) throw invalidInput();

  return Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: uniqueMemberIds,
  });
}

export async function getLeaderboard() {
  const totals = await Activity.aggregate<{ teamName: string; totalPoints: number }>([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    {
      $lookup: {
        from: Team.collection.name,
        localField: '_id',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: '$team' },
    { $sort: { totalPoints: -1, 'team.name': 1 } },
    { $project: { _id: 0, teamName: '$team.name', totalPoints: 1 } },
  ]);
  return totals.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail }).lean();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const [activities, workouts] = await Promise.all([
    Activity.find({ user: user._id }).select('type').lean(),
    Workout.find().lean(),
  ]);
  const activityFocus: Record<string, string> = {
    run: 'endurance',
    cycle: 'endurance',
    strength: 'strength',
    walk: 'mobility',
  };
  const ranked = workouts
    .map((workout, index) => ({
      workout,
      index,
      score:
        (workout.focus === user.fitnessGoal ? 2 : 0) +
        (activities.some((activity) => activityFocus[activity.type] === workout.focus) ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const best = ranked[0]?.workout;
  if (!best) return [];

  const matchingActivities = activities
    .filter((activity) => activityFocus[activity.type] === best.focus)
    .map((activity) => activity.type);
  const reason = matchingActivities.length
    ? `Recommended based on your ${matchingActivities.join(', ')} activity.`
    : `Recommended to support your ${user.fitnessGoal} goal.`;
  return [{ ...best, reason }];
}

export { User };
