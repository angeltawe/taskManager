import * as tf from '@tensorflow/tfjs';

// Simple vocabulary for our "model"
const VOCAB = ['urgent', 'important', 'fix', 'bug', 'soon', 'asap', 'easy', 'later', 'maybe', 'low', 'priority', 'high', 'critical', 'now'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function tokenize(text: string) {
  const tokens = text.toLowerCase().split(/\s+/);
  const sequence = new Array(10).fill(0); // Fixed length input
  tokens.forEach((token, i) => {
    if (i < 10) {
      const index = VOCAB.indexOf(token);
      sequence[i] = index + 1; // +1 to avoid 0 which is padding
    }
  });
  return sequence;
}

let priorityModel: tf.LayersModel | null = null;

export const mlService = {
  async trainPriorityModel() {
    console.log('Training local priority model...');
    const model = tf.sequential();
    model.add(tf.layers.embedding({ inputDim: VOCAB.length + 1, outputDim: 8, inputLength: 10 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: PRIORITIES.length, activation: 'softmax' }));

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Dummy training data
    const trainingData = [
      { text: 'fix this critical bug asap', priority: 'urgent' },
      { text: 'important client meeting', priority: 'high' },
      { text: 'maybe look at this later', priority: 'low' },
      { text: 'routine update', priority: 'medium' },
      { text: 'emergency server down', priority: 'urgent' },
      { text: 'minor style tweak', priority: 'low' },
      { text: 'high priority task for boss', priority: 'high' },
      { text: 'normal priority daily standup', priority: 'medium' },
    ];

    const xs = tf.tensor2d(trainingData.map(d => tokenize(d.text)));
    const ys = tf.tensor2d(trainingData.map(d => {
      const arr = new Array(PRIORITIES.length).fill(0);
      arr[PRIORITIES.indexOf(d.priority)] = 1;
      return arr;
    }));

    await model.fit(xs, ys, { epochs: 50, verbose: 0 });
    priorityModel = model;
    console.log('Local priority model trained.');
  },

  async suggestPriority(title: string, description?: string): Promise<"low" | "medium" | "high" | "urgent"> {
    if (!priorityModel) await this.trainPriorityModel();
    
    const input = tf.tensor2d([tokenize(`${title} ${description || ''}`)]);
    const prediction = priorityModel!.predict(input) as tf.Tensor;
    const index = (await prediction.argMax(1).data())[0];
    
    return PRIORITIES[index] as any;
  },

  async generateSubtasks(title: string, description?: string) {
    // For subtask generation, we'll use a rule-based "generative" approach 
    // that simulates a trained pattern recognizer for typical developer tasks
    const commonPatterns: Record<string, string[]> = {
      'setup': ['Initialize project', 'Install dependencies', 'Configure environment variables'],
      'feature': ['Define requirements', 'Implementation', 'Write unit tests', 'Code review'],
      'bug': ['Reproduce issue', 'Analyze root cause', 'Apply fix', 'Verify fix'],
      'refactor': ['Identify code smells', 'Plan changes', 'Execute refactoring', 'Verify no regression'],
      'deploy': ['Build artifacts', 'Configure production environment', 'Run migration', 'Push to production']
    };

    const text = (title + ' ' + (description || '')).toLowerCase();
    for (const [key, subtasks] of Object.entries(commonPatterns)) {
      if (text.includes(key)) {
        return subtasks.map(s => ({ title: s }));
      }
    }

    return [
      { title: 'Define goals' },
      { title: 'Work on task' },
      { title: 'Review result' }
    ];
  }
};
