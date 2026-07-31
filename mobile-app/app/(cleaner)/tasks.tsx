import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await api.getTasks({ status: 'pending' });
      setTasks(response.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await api.completeTask(taskId, { notes: 'Completed' });
      Alert.alert('Success', 'Task marked as completed');
      loadTasks();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete task');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTasks} />}
    >
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No pending tasks</Text>
        </View>
      ) : (
        tasks.map((task) => (
          <View key={task._id} style={styles.card}>
            <Text style={styles.title}>{task.title}</Text>
            {task.description && <Text style={styles.description}>{task.description}</Text>}
            {task.roomId && (
              <Text style={styles.room}>Room: {task.roomId.roomNumber || 'N/A'}</Text>
            )}
            <Text style={styles.date}>
              Scheduled: {new Date(task.scheduledDate).toLocaleDateString()}
            </Text>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleComplete(task._id)}
            >
              <Text style={styles.completeButtonText}>Mark Complete</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  card: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#11181C',
  },
  description: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 8,
  },
  room: {
    fontSize: 12,
    color: '#0a7ea4',
    marginBottom: 8,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
  },
  completeButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

