import { EPriority, ETaskStatus } from 'src/common/enum/enum';
import { BaseEntity } from '../base/base.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CommentEntity } from '../comment/comment.entity';
import { AssignTaskEntity } from '../assign-task/assign-task.entity';
import { EventEntity } from '../event/event.entity';
import { TaskFileEntity } from '../taskfile/taskfile.entity';

@Entity({ name: 'tasks' })
export class TaskEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  title: string;

  @Column({ type: 'datetime' })
  startDate: Date;

  @Column({ type: 'datetime' })
  endDate: Date;

  @Column({ type: 'varchar' })
  description: string;

  @Column({
    type: 'enum',
    enum: EPriority,
  })
  priority: EPriority;

  // @Column({ type: 'varchar', nullable: true })
  // parentTask: string

  @Column({
    type: 'enum',
    enum: ETaskStatus,
    default: ETaskStatus.PENDING,
  })
  status: ETaskStatus;

  @Column({ type: 'int' })
  estimationTime: number;

  @Column({ type: 'int', nullable: true })
  effort: number;

  @Column({ type: 'varchar' })
  createdBy: string;

  @Column({ type: 'varchar', nullable: true })
  modifiedBy: string;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string;

  @Column({ type: String })
  eventID: string;

  @ManyToOne(() => TaskEntity, (task) => task.subTask)
  @JoinColumn({ name: 'parentTask' })
  parent: TaskEntity;

  @OneToMany(() => TaskEntity, (task) => task.parent)
  subTask: TaskEntity[];

  @ManyToOne(() => EventEntity, (event) => event.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventID', referencedColumnName: 'id' })
  event: EventEntity;

  @OneToMany(() => TaskFileEntity, (taskFiles) => taskFiles.task, {
    onDelete: 'CASCADE',
  })
  taskFiles: TaskFileEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.task, {
    onDelete: 'CASCADE',
  })
  comments: CommentEntity[];

  @OneToMany(() => AssignTaskEntity, (assignTasks) => assignTasks.task, {
    onDelete: 'CASCADE',
  })
  assignTasks: AssignTaskEntity[];
}
