import os

filepath = r'D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\ActiveLatihanPageView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace 1
content = content.replace('ActiveTryoutPageViewProps', 'ActiveLatihanPageViewProps')
content = content.replace('ActiveTryoutPageView', 'ActiveLatihanPageView')

# Replace 2
old_props = '''type ActiveLatihanPageViewProps = {
  attemptId: string;
};'''
new_props = '''type ActiveLatihanPageViewProps = {
  taskId: string;
};'''
content = content.replace(old_props, new_props)

# Replace 3
old_sig = '''export default function ActiveLatihanPageView({ attemptId }: ActiveLatihanPageViewProps) {
  const router = useRouter();'''
new_sig = '''export default function ActiveLatihanPageView({ taskId }: ActiveLatihanPageViewProps) {
  const router = useRouter();
  const attemptId = taskId;'''
content = content.replace(old_sig, new_sig)

# Replace 4
old_api1 = '/api/student/me/exam-attempts/'
new_api1 = '/api/student/me/learning/tasks//cbt'
content = content.replace(old_api1, new_api1)

# Replace 5
old_api2 = '/api/student/me/exam-attempts//submission'
new_api2 = '/api/student/me/learning/tasks//cbt/submission'
content = content.replace(old_api2, new_api2)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
